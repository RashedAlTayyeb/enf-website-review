from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    env: str
    allowed_origin: str
    db_path: Path
    webhook_shared_secret: str

    paytabs_base_url: str
    paytabs_profile_id: str
    paytabs_server_key: str
    paytabs_client_key: str

    aps_base_url: str
    aps_access_code: str
    aps_merchant_identifier: str
    aps_sha_request_phrase: str
    aps_sha_response_phrase: str

    donor_session_ttl_hours: int
    admin_session_ttl_hours: int
    admin_login_max_attempts: int
    admin_login_window_minutes: int
    admin_seed_username: str
    admin_seed_password: str


_DEFAULT_DB = Path("backend/data/enf_donations.db")


def get_settings() -> Settings:
    db_path = Path(os.getenv("ENF_DB_PATH", str(_DEFAULT_DB))).expanduser()
    if not db_path.is_absolute():
        workspace_root = Path(__file__).resolve().parents[2]
        db_path = workspace_root / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)

    return Settings(
        env=os.getenv("ENF_ENV", "development"),
        allowed_origin=os.getenv("ENF_ALLOWED_ORIGIN", "*"),
        db_path=db_path,
        webhook_shared_secret=os.getenv("WEBHOOK_SHARED_SECRET", ""),
        paytabs_base_url=os.getenv("PAYTABS_BASE_URL", "https://secure.paytabs.com"),
        paytabs_profile_id=os.getenv("PAYTABS_PROFILE_ID", ""),
        paytabs_server_key=os.getenv("PAYTABS_SERVER_KEY", ""),
        paytabs_client_key=os.getenv("PAYTABS_CLIENT_KEY", ""),
        aps_base_url=os.getenv("APS_BASE_URL", "https://sbpaymentservices.payfort.com"),
        aps_access_code=os.getenv("APS_ACCESS_CODE", ""),
        aps_merchant_identifier=os.getenv("APS_MERCHANT_IDENTIFIER", ""),
        aps_sha_request_phrase=os.getenv("APS_SHA_REQUEST_PHRASE", ""),
        aps_sha_response_phrase=os.getenv("APS_SHA_RESPONSE_PHRASE", ""),
        donor_session_ttl_hours=int(os.getenv("DONOR_SESSION_TTL_HOURS", "720")),
        admin_session_ttl_hours=int(os.getenv("ADMIN_SESSION_TTL_HOURS", "8")),
        admin_login_max_attempts=int(os.getenv("ADMIN_LOGIN_MAX_ATTEMPTS", "3")),
        admin_login_window_minutes=int(os.getenv("ADMIN_LOGIN_WINDOW_MINUTES", "15")),
        admin_seed_username=os.getenv("ENF_ADMIN_USERNAME", "admin"),
        admin_seed_password=os.getenv("ENF_ADMIN_PASSWORD", ""),
    )
