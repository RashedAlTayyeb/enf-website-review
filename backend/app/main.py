from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None

from app.providers.base import GatewayIntegrationError, WebhookVerificationError
from app.schemas import (
    AdminContentResponse,
    AdminContentUpdateRequest,
    AdminLoginRequest,
    AdminLoginResponse,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    DonorAuthSessionResponse,
    DonorProfileResponse,
    DonorSignInRequest,
    DonorSignUpRequest,
    SubscriptionCancelRequest,
    WebhookAcknowledgeResponse,
)
from app.services.donation_service import DonationService
from app.settings import get_settings
from app.storage import DonationStore

if load_dotenv:
    load_dotenv("backend/.env")

settings = get_settings()
store = DonationStore(settings.db_path)
service = DonationService(store=store, settings=settings)
if settings.admin_seed_username and settings.admin_seed_password:
    store.ensure_admin_user(settings.admin_seed_username, settings.admin_seed_password)

app = FastAPI(
    title="ENF Donation API",
    version="0.1.0",
    description="Backend scaffold for one-time and recurring donations with webhook reconciliation.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin] if settings.allowed_origin != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "environment": settings.env,
        "database": str(settings.db_path),
    }


def _bearer_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    return header.split(" ", 1)[1].strip()


@app.post("/api/v1/donations/checkout-session", response_model=CheckoutSessionResponse)
def create_checkout_session(payload: CheckoutSessionRequest):
    result = service.create_checkout_session(payload)
    status = 200 if result.gateway_ready else 503
    return JSONResponse(status_code=status, content=result.model_dump(mode="json"))


@app.get("/api/v1/donations/{donation_reference}")
def get_donation(donation_reference: str):
    row = service.get_donation(donation_reference)
    if not row:
        raise HTTPException(status_code=404, detail="Donation not found.")
    return row.model_dump(mode="json")


@app.post("/api/v1/auth/sign-up", response_model=DonorAuthSessionResponse)
def donor_sign_up(payload: DonorSignUpRequest):
    try:
        result = store.create_donor_account(
            payload.model_dump(mode="json"),
            session_ttl_hours=settings.donor_session_ttl_hours,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/v1/auth/sign-in", response_model=DonorAuthSessionResponse)
def donor_sign_in(payload: DonorSignInRequest):
    try:
        result = store.authenticate_donor(
            payload.email,
            payload.password,
            session_ttl_hours=settings.donor_session_ttl_hours,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@app.get("/api/v1/auth/profile", response_model=DonorProfileResponse)
def donor_profile(request: Request):
    token = _bearer_token(request)
    profile = store.get_donor_profile_by_token(token)
    if not profile:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")
    return profile


@app.post("/api/v1/subscriptions/{subscription_reference}/cancel-request")
def request_cancel(subscription_reference: str, payload: SubscriptionCancelRequest):
    ok = service.request_subscription_cancellation(subscription_reference, payload)
    if not ok:
        raise HTTPException(status_code=404, detail="Subscription not found or email does not match donor record.")
    return {"accepted": True, "subscription_reference": subscription_reference, "status": "cancel_requested"}


@app.get("/api/v1/admin/subscriptions")
def list_subscriptions(request: Request, limit: int = Query(default=50, ge=1, le=200)):
    token = _bearer_token(request)
    admin = store.verify_admin_session(token)
    if not admin:
        raise HTTPException(status_code=401, detail="Admin session is invalid or expired.")
    return {"items": service.list_subscriptions(limit=limit)}


@app.post("/api/v1/admin/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest, request: Request):
    client_ip = (request.client.host if request.client else "") or "unknown"
    identifier = f"{payload.username.strip().lower()}|{client_ip}"
    failed_attempts = store.count_recent_failed_admin_attempts(
        identifier, settings.admin_login_window_minutes
    )
    if failed_attempts >= settings.admin_login_max_attempts:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Too many failed attempts. Try again in "
                f"{settings.admin_login_window_minutes} minutes."
            ),
        )
    try:
        session = store.create_admin_session(
            payload.username,
            payload.password,
            session_ttl_hours=settings.admin_session_ttl_hours,
        )
        store.record_admin_login_attempt(identifier, success=True)
        return session
    except ValueError as exc:
        store.record_admin_login_attempt(identifier, success=False)
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@app.post("/api/v1/admin/logout")
def admin_logout(request: Request):
    token = _bearer_token(request)
    store.revoke_admin_session(token)
    return {"ok": True}


@app.get("/api/v1/admin/content/{section_key}", response_model=AdminContentResponse)
def get_admin_content(section_key: str, request: Request):
    token = _bearer_token(request)
    admin = store.verify_admin_session(token)
    if not admin:
        raise HTTPException(status_code=401, detail="Admin session is invalid or expired.")
    return store.get_admin_content(section_key)


@app.put("/api/v1/admin/content/{section_key}", response_model=AdminContentResponse)
def save_admin_content(section_key: str, payload: AdminContentUpdateRequest, request: Request):
    token = _bearer_token(request)
    admin = store.verify_admin_session(token)
    if not admin:
        raise HTTPException(status_code=401, detail="Admin session is invalid or expired.")
    return store.upsert_admin_content(section_key, payload.content, updated_by=admin["username"])


@app.post("/api/v1/payments/webhooks/{provider}", response_model=WebhookAcknowledgeResponse)
async def handle_webhook(provider: str, request: Request):
    raw = await request.body()
    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {exc}") from exc

    headers = {k.lower(): v for k, v in request.headers.items()}
    try:
        result = service.process_webhook(provider=provider, headers=headers, payload=payload, raw_body=raw)
        return result.model_dump(mode="json")
    except WebhookVerificationError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except GatewayIntegrationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
