from __future__ import annotations

from typing import Any

from app.providers.base import (
    CheckoutSessionResult,
    GatewayNotConfiguredError,
    PaymentGateway,
    WebhookResult,
    WebhookVerificationError,
)
from app.settings import Settings


class APSGateway(PaymentGateway):
    provider_name = "aps"

    def __init__(self, settings: Settings):
        self.settings = settings

    def is_configured(self) -> bool:
        return bool(self.settings.aps_access_code and self.settings.aps_merchant_identifier)

    def create_checkout_session(self, donation_reference: str, payload: dict[str, Any]) -> CheckoutSessionResult:
        if not self.is_configured():
            raise GatewayNotConfiguredError(
                "APS credentials are missing. Set APS_ACCESS_CODE and APS_MERCHANT_IDENTIFIER in backend/.env."
            )

        # Intentional: integration-ready scaffold only.
        # Real implementation should prepare APS command payload and redirect donor to hosted payment page.
        provider_reference = f"APS-PENDING-{donation_reference}"
        return CheckoutSessionResult(
            checkout_url=None,
            provider_reference=provider_reference,
            status="pending_gateway_activation",
            detail=(
                "APS adapter scaffold is ready but request signing and command mapping "
                "must be completed using your merchant credentials."
            ),
        )

    def parse_webhook(self, headers: dict[str, str], payload: dict[str, Any], raw_body: bytes) -> WebhookResult:
        secret = self.settings.webhook_shared_secret
        if secret:
            provided = headers.get("x-enf-webhook-secret", "")
            if provided != secret:
                raise WebhookVerificationError("Invalid webhook shared secret.")

        event_id = str(payload.get("fort_id") or payload.get("merchant_reference") or payload.get("id") or "")
        if not event_id:
            raise WebhookVerificationError("Missing APS event identifier.")

        status_code = str(payload.get("status") or "")
        response_code = str(payload.get("response_code") or "")
        provider_reference = str(payload.get("fort_id") or payload.get("merchant_reference") or "")

        if status_code in {"14", "18"} or response_code.startswith("14"):
            donation_status = "paid"
        elif status_code in {"02", "04"}:
            donation_status = "pending"
        elif status_code in {"20", "44"}:
            donation_status = "failed"
        else:
            donation_status = "pending"

        return WebhookResult(
            event_id=event_id,
            donation_status=donation_status,
            provider_reference=provider_reference or None,
            detail=payload.get("response_message"),
        )
