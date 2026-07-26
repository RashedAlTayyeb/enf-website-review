from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DonorInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: Optional[str] = Field(default=None, max_length=80)
    email: str = Field(min_length=3, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=50)
    message: Optional[str] = Field(default=None, max_length=3000)


class CheckoutSessionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    mode: Literal["one_time", "monthly"]
    amount_jod: float = Field(gt=0)
    currency: Literal["JOD"] = "JOD"
    provider: Literal["paytabs", "aps"]
    payment_channel: Optional[str] = Field(default="card", max_length=40)

    service_code: Optional[str] = Field(default=None, max_length=40)
    plan_id: Optional[str] = Field(default=None, max_length=64)
    purpose: Optional[str] = Field(default=None, max_length=120)
    category_code: Optional[str] = Field(default=None, max_length=40)
    reference_note: Optional[str] = Field(default=None, max_length=120)

    recurring_consent: bool = False
    recurring_consent_timestamp: Optional[datetime] = None

    donor: DonorInput

    success_url: str = Field(min_length=6, max_length=500)
    failure_url: str = Field(min_length=6, max_length=500)
    manage_url: Optional[str] = Field(default=None, max_length=500)
    source_page: Optional[str] = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_monthly_consent(self) -> "CheckoutSessionRequest":
        if self.mode == "monthly" and not self.recurring_consent:
            raise ValueError("Monthly subscriptions require recurring_consent=true.")
        return self


class CheckoutSessionResponse(BaseModel):
    donation_reference: str
    donation_status: str
    checkout_url: Optional[str] = None
    provider_reference: Optional[str] = None
    gateway_ready: bool
    detail: Optional[str] = None


class DonationStatusResponse(BaseModel):
    donation_reference: str
    mode: str
    amount_jod: float
    currency: str
    provider: str
    status: str
    service_code: Optional[str] = None
    purpose: Optional[str] = None
    category_code: Optional[str] = None
    recurring_consent: bool
    donor: dict
    subscription: Optional[dict] = None
    created_at: str
    updated_at: str


class SubscriptionCancelRequest(BaseModel):
    donor_email: Optional[str] = Field(default=None, max_length=160)
    reason: str = Field(min_length=4, max_length=1500)


class WebhookAcknowledgeResponse(BaseModel):
    accepted: bool
    event_status: str
    donation_reference: Optional[str] = None
    provider_reference: Optional[str] = None
    detail: Optional[str] = None


class DonorSignUpRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    first_name: str = Field(min_length=1, max_length=80)
    last_name: Optional[str] = Field(default=None, max_length=80)
    email: str = Field(min_length=3, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=50)
    password: str = Field(min_length=8, max_length=120)


class DonorSignInRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=120)


class DonorProfileResponse(BaseModel):
    email: str
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None


class DonorAuthSessionResponse(BaseModel):
    token: str
    profile: DonorProfileResponse


class AdminLoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    username: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=120)


class AdminLoginResponse(BaseModel):
    token: str
    username: str


class AdminContentUpdateRequest(BaseModel):
    content: dict


class AdminContentResponse(BaseModel):
    section_key: str
    content: dict
    updated_at: Optional[str] = None
