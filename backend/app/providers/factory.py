from __future__ import annotations

from app.providers.aps import APSGateway
from app.providers.base import PaymentGateway
from app.providers.paytabs import PayTabsGateway
from app.settings import Settings


def get_gateway(provider: str, settings: Settings) -> PaymentGateway:
    name = (provider or "").lower().strip()
    if name == "paytabs":
        return PayTabsGateway(settings)
    if name == "aps":
        return APSGateway(settings)
    raise ValueError(f"Unsupported provider: {provider}")
