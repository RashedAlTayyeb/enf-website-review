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


class PayTabsGateway(PaymentGateway):
    provider_name = "paytabs"

    def __init__(self, settings: Settings):
        self.settings = settings

    def is_configured(self) -> bool:
        return bool(self.settings.paytabs_profile_id and self.settings.paytabs_server_key)

    def create_checkout_session(self, donation_reference: str, payload: dict[str, Any]) -> CheckoutSessionResult:
        if not self.is_configured():
            raise GatewayNotConfiguredError(
                "PayTabs credentials are missing. Set PAYTABS_PROFILE_ID and PAYTABS_SERVER_KEY in backend/.env."
            )

        # Intentional: integration-ready scaffold only.
        # Real implementation should call PayTabs payment page endpoint and return their hosted checkout URL.
        provider_reference = f"PT-PENDING-{donation_reference}"
        return CheckoutSessionResult(
            checkout_url=None,
            provider_reference=provider_reference,
            status="pending_gateway_activation",
            detail=(
                "PayTabs adapter scaffold is ready but API request signing/body mapping must be finalized "
                "with your live merchant configuration."
            ),
        )

    def parse_webhook(self, headers: dict[str, str], payload: dict[str, Any], raw_body: bytes) -> WebhookResult:
        secret = self.settings.webhook_shared_secret
        if secret:
            provided = headers.get("x-enf-webhook-secret", "")
            if provided != secret:
                raise WebhookVerificationError("Invalid webhook shared secret.")

        event_id = str(payload.get("tran_ref") or payload.get("transaction_id") or payload.get("id") or "")
        if not event_id:
            raise WebhookVerificationError("Missing PayTabs event identifier.")

        payment_status = str(payload.get("payment_result", {}).get("response_status") or payload.get("payment_status") or "").upper()
        provider_reference = str(payload.get("tran_ref") or payload.get("transaction_id") or "")

        if payment_status in {"A", "CAPTURED", "PAID", "SUCCESS"}:
            donation_status = "paid"
        elif payment_status in {"P", "PENDING"}:
            donation_status = "pending"
        elif payment_status in {"CANCELLED", "CANCELED", "DECLINED", "E"}:
            donation_status = "failed"
        else:
            donation_status = "pending"

        return WebhookResult(
            event_id=event_id,
            donation_status=donation_status,
            provider_reference=provider_reference or None,
            detail=payload.get("message") or payload.get("payment_result", {}).get("response_message"),
        )
