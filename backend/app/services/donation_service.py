from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any

from app.providers.base import GatewayIntegrationError, GatewayNotConfiguredError
from app.providers.factory import get_gateway
from app.schemas import (
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    DonationStatusResponse,
    SubscriptionCancelRequest,
    WebhookAcknowledgeResponse,
)
from app.settings import Settings
from app.storage import DonationStore


class DonationService:
    def __init__(self, store: DonationStore, settings: Settings):
        self.store = store
        self.settings = settings

    @staticmethod
    def _donation_reference() -> str:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
        return f"ENF-{stamp}-{secrets.token_hex(3).upper()}"

    @staticmethod
    def _subscription_reference() -> str:
        stamp = datetime.now(timezone.utc).strftime("%Y%m")
        return f"SUB-{stamp}-{secrets.token_hex(4).upper()}"

    def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        payload = request.model_dump(mode="json")
        payment_channel = str(payload.get("payment_channel") or "card").strip().lower()

        # Channel-first routing for wallet/handoff methods.
        # These channels should not blindly attempt APS gateway initialization unless a
        # dedicated adapter is implemented and explicitly configured.
        channel_labels = {
            "orange_money": "Orange Money",
            "zain_cash": "Zain Cash",
        }
        if payment_channel in channel_labels:
            donor_id = self.store.upsert_donor(payload["donor"])
            donation_reference = self._donation_reference()
            payload["provider"] = "wallet_handoff"
            self.store.create_donation(donation_reference, donor_id, payload)
            self.store.update_donation_checkout(
                donation_reference=donation_reference,
                status="pending_channel_integration",
                provider_reference=None,
                checkout_url=None,
                detail=(
                    f"{channel_labels[payment_channel]} integration is not configured yet for this environment. "
                    "Configure its dedicated provider handoff/redirect flow and callback URLs."
                ),
            )
            return CheckoutSessionResponse(
                donation_reference=donation_reference,
                donation_status="pending_channel_integration",
                checkout_url=None,
                provider_reference=None,
                gateway_ready=False,
                detail=(
                    f"{channel_labels[payment_channel]} integration is not configured yet for this environment."
                ),
            )

        donor_id = self.store.upsert_donor(payload["donor"])
        donation_reference = self._donation_reference()

        self.store.create_donation(donation_reference, donor_id, payload)

        if payload["mode"] == "monthly":
            subscription_reference = self._subscription_reference()
            self.store.create_subscription(subscription_reference, donation_reference, donor_id, payload)

        try:
            gateway = get_gateway(payload["provider"], self.settings)
            checkout = gateway.create_checkout_session(donation_reference, payload)

            self.store.update_donation_checkout(
                donation_reference=donation_reference,
                status=checkout.status,
                provider_reference=checkout.provider_reference,
                checkout_url=checkout.checkout_url,
                detail=checkout.detail,
            )

            return CheckoutSessionResponse(
                donation_reference=donation_reference,
                donation_status=checkout.status,
                checkout_url=checkout.checkout_url,
                provider_reference=checkout.provider_reference,
                gateway_ready=bool(checkout.checkout_url),
                detail=checkout.detail,
            )

        except (GatewayNotConfiguredError, GatewayIntegrationError) as exc:
            self.store.update_donation_checkout(
                donation_reference=donation_reference,
                status="pending_gateway_setup",
                provider_reference=None,
                checkout_url=None,
                detail=str(exc),
            )
            return CheckoutSessionResponse(
                donation_reference=donation_reference,
                donation_status="pending_gateway_setup",
                checkout_url=None,
                provider_reference=None,
                gateway_ready=False,
                detail=str(exc),
            )

    def get_donation(self, donation_reference: str) -> DonationStatusResponse | None:
        row = self.store.get_donation(donation_reference)
        if not row:
            return None

        subscription = None
        if row.get("subscription_reference"):
            subscription = {
                "subscription_reference": row.get("subscription_reference"),
                "status": row.get("subscription_status"),
                "cancel_requested": bool(row.get("cancel_requested")),
                "cancel_reason": row.get("cancel_reason"),
            }

        return DonationStatusResponse(
            donation_reference=row["donation_reference"],
            mode=row["mode"],
            amount_jod=float(row["amount_jod"]),
            currency=row["currency"],
            provider=row["provider"],
            status=row["status"],
            service_code=row.get("service_code"),
            purpose=row.get("purpose"),
            category_code=row.get("category_code"),
            recurring_consent=bool(row.get("recurring_consent")),
            donor={
                "first_name": row.get("first_name"),
                "last_name": row.get("last_name"),
                "email": row.get("email"),
                "phone": row.get("phone"),
            },
            subscription=subscription,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def process_webhook(
        self,
        provider: str,
        headers: dict[str, str],
        payload: dict[str, Any],
        raw_body: bytes,
    ) -> WebhookAcknowledgeResponse:
        gateway = get_gateway(provider, self.settings)
        event = gateway.parse_webhook(headers, payload, raw_body)

        inserted = self.store.record_webhook_event(
            provider=provider,
            event_id=event.event_id,
            payload=payload,
            status=event.donation_status,
            detail=event.detail,
        )
        if not inserted:
            return WebhookAcknowledgeResponse(
                accepted=True,
                event_status="duplicate",
                provider_reference=event.provider_reference,
                detail="Duplicate webhook event ignored.",
            )

        donation_reference = None
        if event.provider_reference:
            donation_reference = self.store.update_donation_status_by_provider_reference(
                provider_reference=event.provider_reference,
                status=event.donation_status,
            )

        if donation_reference and event.donation_status in {"paid", "failed", "cancelled"}:
            subscription_status = "active" if event.donation_status == "paid" else "payment_failed"
            self.store.update_subscription_status_by_donation(donation_reference, subscription_status)

        return WebhookAcknowledgeResponse(
            accepted=True,
            event_status=event.donation_status,
            donation_reference=donation_reference,
            provider_reference=event.provider_reference,
            detail=event.detail,
        )

    def request_subscription_cancellation(
        self,
        subscription_reference: str,
        request: SubscriptionCancelRequest,
    ) -> bool:
        return self.store.request_subscription_cancel(
            subscription_reference=subscription_reference,
            donor_email=request.donor_email,
            reason=request.reason,
        )

    def list_subscriptions(self, limit: int = 50) -> list[dict[str, Any]]:
        return self.store.list_subscriptions(limit=limit)
