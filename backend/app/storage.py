from __future__ import annotations

import json
import sqlite3
import hashlib
import secrets
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DonationStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                PRAGMA foreign_keys = ON;

                CREATE TABLE IF NOT EXISTS donors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    first_name TEXT NOT NULL,
                    last_name TEXT,
                    phone TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS donations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    donation_reference TEXT NOT NULL UNIQUE,
                    donor_id INTEGER NOT NULL,
                    mode TEXT NOT NULL,
                    amount_jod REAL NOT NULL,
                    currency TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    service_code TEXT,
                    plan_id TEXT,
                    purpose TEXT,
                    category_code TEXT,
                    reference_note TEXT,
                    recurring_consent INTEGER NOT NULL DEFAULT 0,
                    recurring_consent_timestamp TEXT,
                    status TEXT NOT NULL,
                    provider_reference TEXT,
                    checkout_url TEXT,
                    detail TEXT,
                    metadata_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (donor_id) REFERENCES donors(id)
                );

                CREATE TABLE IF NOT EXISTS subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subscription_reference TEXT NOT NULL UNIQUE,
                    donation_reference TEXT NOT NULL UNIQUE,
                    donor_id INTEGER NOT NULL,
                    provider TEXT NOT NULL,
                    plan_id TEXT,
                    amount_jod REAL NOT NULL,
                    status TEXT NOT NULL,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    cancel_reason TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (donation_reference) REFERENCES donations(donation_reference),
                    FOREIGN KEY (donor_id) REFERENCES donors(id)
                );

                CREATE TABLE IF NOT EXISTS webhook_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    detail TEXT,
                    received_at TEXT NOT NULL,
                    processed_at TEXT,
                    UNIQUE(provider, event_id)
                );

                CREATE TABLE IF NOT EXISTS donor_accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    first_name TEXT NOT NULL,
                    last_name TEXT,
                    phone TEXT,
                    password_hash TEXT NOT NULL,
                    password_salt TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS donor_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    token TEXT NOT NULL UNIQUE,
                    donor_account_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    FOREIGN KEY (donor_account_id) REFERENCES donor_accounts(id)
                );

                CREATE TABLE IF NOT EXISTS admin_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    password_salt TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS admin_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    token TEXT NOT NULL UNIQUE,
                    admin_user_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
                );

                CREATE TABLE IF NOT EXISTS admin_content (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    section_key TEXT NOT NULL UNIQUE,
                    content_json TEXT NOT NULL,
                    updated_by TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS admin_login_attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    identifier TEXT NOT NULL,
                    success INTEGER NOT NULL DEFAULT 0,
                    attempted_at TEXT NOT NULL
                );
                """
            )

    def upsert_donor(self, donor: dict[str, Any]) -> int:
        now = now_iso()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id FROM donors WHERE email = ? ORDER BY id DESC LIMIT 1",
                (donor["email"],),
            ).fetchone()
            if row:
                donor_id = int(row["id"])
                conn.execute(
                    """
                    UPDATE donors
                    SET first_name = ?, last_name = ?, phone = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (donor["first_name"], donor.get("last_name"), donor.get("phone"), now, donor_id),
                )
                return donor_id

            cur = conn.execute(
                """
                INSERT INTO donors (email, first_name, last_name, phone, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    donor["email"],
                    donor["first_name"],
                    donor.get("last_name"),
                    donor.get("phone"),
                    now,
                    now,
                ),
            )
            return int(cur.lastrowid)

    def create_donation(self, donation_reference: str, donor_id: int, payload: dict[str, Any]) -> None:
        now = now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO donations (
                    donation_reference,
                    donor_id,
                    mode,
                    amount_jod,
                    currency,
                    provider,
                    service_code,
                    plan_id,
                    purpose,
                    category_code,
                    reference_note,
                    recurring_consent,
                    recurring_consent_timestamp,
                    status,
                    metadata_json,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    donation_reference,
                    donor_id,
                    payload["mode"],
                    payload["amount_jod"],
                    payload["currency"],
                    payload["provider"],
                    payload.get("service_code"),
                    payload.get("plan_id"),
                    payload.get("purpose"),
                    payload.get("category_code"),
                    payload.get("reference_note"),
                    1 if payload.get("recurring_consent") else 0,
                    payload.get("recurring_consent_timestamp"),
                    "initiated",
                    json.dumps(
                        {
                            "success_url": payload.get("success_url"),
                            "failure_url": payload.get("failure_url"),
                            "manage_url": payload.get("manage_url"),
                            "source_page": payload.get("source_page"),
                            "donor_message": payload.get("donor", {}).get("message"),
                            "payment_channel": payload.get("payment_channel") or "card",
                        }
                    ),
                    now,
                    now,
                ),
            )

    def create_subscription(self, subscription_reference: str, donation_reference: str, donor_id: int, payload: dict[str, Any]) -> None:
        now = now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO subscriptions (
                    subscription_reference,
                    donation_reference,
                    donor_id,
                    provider,
                    plan_id,
                    amount_jod,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    subscription_reference,
                    donation_reference,
                    donor_id,
                    payload["provider"],
                    payload.get("plan_id") or "custom",
                    payload["amount_jod"],
                    "pending_activation",
                    now,
                    now,
                ),
            )

    def update_donation_checkout(
        self,
        donation_reference: str,
        status: str,
        provider_reference: Optional[str],
        checkout_url: Optional[str],
        detail: Optional[str] = None,
    ) -> None:
        now = now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE donations
                SET status = ?, provider_reference = ?, checkout_url = ?, detail = ?, updated_at = ?
                WHERE donation_reference = ?
                """,
                (status, provider_reference, checkout_url, detail, now, donation_reference),
            )

    def update_donation_status_by_provider_reference(self, provider_reference: str, status: str) -> Optional[str]:
        now = now_iso()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT donation_reference FROM donations WHERE provider_reference = ?",
                (provider_reference,),
            ).fetchone()
            if not row:
                return None
            donation_reference = str(row["donation_reference"])
            conn.execute(
                "UPDATE donations SET status = ?, updated_at = ? WHERE donation_reference = ?",
                (status, now, donation_reference),
            )
            return donation_reference

    def update_subscription_status_by_donation(self, donation_reference: str, status: str) -> None:
        now = now_iso()
        with self._connect() as conn:
            conn.execute(
                "UPDATE subscriptions SET status = ?, updated_at = ? WHERE donation_reference = ?",
                (status, now, donation_reference),
            )

    def request_subscription_cancel(self, subscription_reference: str, donor_email: Optional[str], reason: str) -> bool:
        now = now_iso()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT s.subscription_reference, d.email
                FROM subscriptions s
                JOIN donors d ON d.id = s.donor_id
                WHERE s.subscription_reference = ?
                """,
                (subscription_reference,),
            ).fetchone()
            if not row:
                return False
            if donor_email and donor_email.lower() != str(row["email"]).lower():
                return False
            conn.execute(
                """
                UPDATE subscriptions
                SET cancel_requested = 1,
                    cancel_reason = ?,
                    status = 'cancel_requested',
                    updated_at = ?
                WHERE subscription_reference = ?
                """,
                (reason, now, subscription_reference),
            )
            return True

    def record_webhook_event(self, provider: str, event_id: str, payload: dict[str, Any], status: str, detail: Optional[str] = None) -> bool:
        now = now_iso()
        with self._connect() as conn:
            try:
                conn.execute(
                    """
                    INSERT INTO webhook_events (provider, event_id, payload_json, status, detail, received_at, processed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (provider, event_id, json.dumps(payload), status, detail, now, now),
                )
                return True
            except sqlite3.IntegrityError:
                return False

    def get_donation(self, donation_reference: str) -> Optional[dict[str, Any]]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT d.*, p.email, p.first_name, p.last_name, p.phone,
                       s.subscription_reference, s.status AS subscription_status,
                       s.cancel_requested, s.cancel_reason
                FROM donations d
                JOIN donors p ON p.id = d.donor_id
                LEFT JOIN subscriptions s ON s.donation_reference = d.donation_reference
                WHERE d.donation_reference = ?
                """,
                (donation_reference,),
            ).fetchone()
            if not row:
                return None
            return dict(row)

    def list_subscriptions(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT s.subscription_reference,
                       s.donation_reference,
                       s.provider,
                       s.plan_id,
                       s.amount_jod,
                       s.status,
                       s.cancel_requested,
                       s.cancel_reason,
                       s.created_at,
                       s.updated_at,
                       d.email
                FROM subscriptions s
                JOIN donors d ON d.id = s.donor_id
                ORDER BY s.updated_at DESC
                LIMIT ?
                """,
                (max(1, min(limit, 200)),),
            ).fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    def _hash_password(password: str, salt: str) -> str:
        return hashlib.sha256((salt + ":" + password).encode("utf-8")).hexdigest()

    @staticmethod
    def _sanitize_content_value(value: Any) -> Any:
        if isinstance(value, dict):
            return {str(k): DonationStore._sanitize_content_value(v) for k, v in value.items()}
        if isinstance(value, list):
            return [DonationStore._sanitize_content_value(item) for item in value]
        if isinstance(value, str):
            cleaned = re.sub(r"(?is)<script.*?>.*?</script>", "", value)
            cleaned = re.sub(r"(?i)javascript:", "", cleaned)
            return cleaned
        return value

    def ensure_admin_user(self, username: str, password: str) -> None:
        now = now_iso()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id FROM admin_users WHERE lower(email) = lower(?)",
                (username,),
            ).fetchone()
            salt = secrets.token_hex(16)
            password_hash = self._hash_password(password, salt)
            if row:
                conn.execute(
                    """
                    UPDATE admin_users
                    SET password_hash = ?, password_salt = ?, updated_at = ?, is_active = 1
                    WHERE id = ?
                    """,
                    (password_hash, salt, now, int(row["id"])),
                )
                return
            conn.execute(
                """
                INSERT INTO admin_users (email, password_hash, password_salt, is_active, created_at, updated_at)
                VALUES (?, ?, ?, 1, ?, ?)
                """,
                (username, password_hash, salt, now, now),
            )

    def create_donor_account(self, payload: dict[str, Any], session_ttl_hours: int) -> dict[str, Any]:
        now = now_iso()
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id FROM donor_accounts WHERE lower(email) = lower(?)",
                (payload["email"],),
            ).fetchone()
            if existing:
                raise ValueError("A donor account already exists for this email.")

            salt = secrets.token_hex(16)
            password_hash = self._hash_password(payload["password"], salt)
            cur = conn.execute(
                """
                INSERT INTO donor_accounts (email, first_name, last_name, phone, password_hash, password_salt, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["email"],
                    payload["first_name"],
                    payload.get("last_name"),
                    payload.get("phone"),
                    password_hash,
                    salt,
                    now,
                    now,
                ),
            )
            account_id = int(cur.lastrowid)
            session = self._create_donor_session(conn, account_id, session_ttl_hours)
            return {
                "token": session["token"],
                "profile": {
                    "email": payload["email"],
                    "first_name": payload["first_name"],
                    "last_name": payload.get("last_name"),
                    "phone": payload.get("phone"),
                },
            }

    def authenticate_donor(self, email: str, password: str, session_ttl_hours: int) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, email, first_name, last_name, phone, password_hash, password_salt
                FROM donor_accounts
                WHERE lower(email) = lower(?)
                """,
                (email,),
            ).fetchone()
            if not row:
                raise ValueError("Invalid email or password.")
            expected = self._hash_password(password, str(row["password_salt"]))
            if expected != str(row["password_hash"]):
                raise ValueError("Invalid email or password.")
            session = self._create_donor_session(conn, int(row["id"]), session_ttl_hours)
            return {
                "token": session["token"],
                "profile": {
                    "email": str(row["email"]),
                    "first_name": str(row["first_name"]),
                    "last_name": row["last_name"],
                    "phone": row["phone"],
                },
            }

    def _create_donor_session(self, conn: sqlite3.Connection, account_id: int, session_ttl_hours: int) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        expires = now.timestamp() + max(1, session_ttl_hours) * 3600
        token = "donor_" + secrets.token_urlsafe(32)
        conn.execute(
            """
            INSERT INTO donor_sessions (token, donor_account_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, account_id, datetime.fromtimestamp(now.timestamp(), timezone.utc).isoformat(), datetime.fromtimestamp(expires, timezone.utc).isoformat()),
        )
        return {"token": token}

    def get_donor_profile_by_token(self, token: str) -> Optional[dict[str, Any]]:
        now = now_iso()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT a.email, a.first_name, a.last_name, a.phone
                FROM donor_sessions s
                JOIN donor_accounts a ON a.id = s.donor_account_id
                WHERE s.token = ? AND s.expires_at > ?
                """,
                (token, now),
            ).fetchone()
            if not row:
                return None
            return {
                "email": str(row["email"]),
                "first_name": str(row["first_name"]),
                "last_name": row["last_name"],
                "phone": row["phone"],
            }

    def create_admin_session(self, username: str, password: str, session_ttl_hours: int) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, email, password_hash, password_salt, is_active
                FROM admin_users
                WHERE lower(email) = lower(?)
                """,
                (username,),
            ).fetchone()
            if not row or int(row["is_active"]) != 1:
                raise ValueError("Invalid admin credentials.")
            expected = self._hash_password(password, str(row["password_salt"]))
            if expected != str(row["password_hash"]):
                raise ValueError("Invalid admin credentials.")
            now = datetime.now(timezone.utc)
            expires = now.timestamp() + max(1, session_ttl_hours) * 3600
            token = "admin_" + secrets.token_urlsafe(32)
            conn.execute(
                """
                INSERT INTO admin_sessions (token, admin_user_id, created_at, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    token,
                    int(row["id"]),
                    datetime.fromtimestamp(now.timestamp(), timezone.utc).isoformat(),
                    datetime.fromtimestamp(expires, timezone.utc).isoformat(),
                ),
            )
            return {
                "token": token,
                "username": str(row["email"]),
            }

    def revoke_admin_session(self, token: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM admin_sessions WHERE token = ?", (token,))

    def record_admin_login_attempt(self, identifier: str, success: bool) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO admin_login_attempts (identifier, success, attempted_at)
                VALUES (?, ?, ?)
                """,
                (identifier, 1 if success else 0, now_iso()),
            )

    def count_recent_failed_admin_attempts(self, identifier: str, window_minutes: int) -> int:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) AS c
                FROM admin_login_attempts
                WHERE identifier = ?
                  AND success = 0
                  AND julianday(attempted_at) >= julianday('now', ?)
                """,
                (identifier, f"-{max(1, window_minutes)} minutes"),
            ).fetchone()
            return int(row["c"]) if row else 0

    def verify_admin_session(self, token: str) -> Optional[dict[str, Any]]:
        now = now_iso()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT u.id, u.email
                FROM admin_sessions s
                JOIN admin_users u ON u.id = s.admin_user_id
                WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1
                """,
                (token, now),
            ).fetchone()
            if not row:
                return None
            return {
                "admin_user_id": int(row["id"]),
                "username": str(row["email"]),
            }

    def get_admin_content(self, section_key: str) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT section_key, content_json, updated_at FROM admin_content WHERE section_key = ?",
                (section_key,),
            ).fetchone()
            if not row:
                return {
                    "section_key": section_key,
                    "content": {},
                    "updated_at": None,
                }
            try:
                content = json.loads(str(row["content_json"]))
            except json.JSONDecodeError:
                content = {}
            return {
                "section_key": str(row["section_key"]),
                "content": content,
                "updated_at": row["updated_at"],
            }

    def upsert_admin_content(self, section_key: str, content: dict[str, Any], updated_by: str) -> dict[str, Any]:
        now = now_iso()
        clean_content = self._sanitize_content_value(content)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO admin_content (section_key, content_json, updated_by, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(section_key) DO UPDATE SET
                    content_json = excluded.content_json,
                    updated_by = excluded.updated_by,
                    updated_at = excluded.updated_at
                """,
                (section_key, json.dumps(clean_content), updated_by, now),
            )
        return {
            "section_key": section_key,
            "content": clean_content,
            "updated_at": now,
        }
