from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional


class GatewayIntegrationError(RuntimeError):
    """Raised when gateway integration fails or is incomplete."""


class GatewayNotConfiguredError(GatewayIntegrationError):
    """Raised when required merchant credentials are missing."""


class WebhookVerificationError(GatewayIntegrationError):
    """Raised when webhook verification/signature checks fail."""


@dataclass
class CheckoutSessionResult:
    checkout_url: Optional[str]
    provider_reference: Optional[str]
    status: str
    detail: Optional[str] = None


@dataclass
class WebhookResult:
    event_id: str
    donation_status: str
    provider_reference: Optional[str]
    detail: Optional[str] = None


class PaymentGateway(ABC):
    provider_name: str

    @abstractmethod
    def is_configured(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def create_checkout_session(self, donation_reference: str, payload: dict[str, Any]) -> CheckoutSessionResult:
        raise NotImplementedError

    @abstractmethod
    def parse_webhook(self, headers: dict[str, str], payload: dict[str, Any], raw_body: bytes) -> WebhookResult:
        raise NotImplementedError
