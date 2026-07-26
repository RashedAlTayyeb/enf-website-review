# ENF Backend Donation Scaffold

This backend is prepared for **real one-time and recurring donations** with clean separation from the static front-end.

## What this already implements

- `POST /api/v1/donations/checkout-session`
  - validates donation request (one-time vs monthly)
  - enforces monthly recurring consent flag
  - creates donor + donation records
  - creates subscription record for monthly mode
  - routes request to a provider adapter (`paytabs` or `aps`)
- `POST /api/v1/payments/webhooks/{provider}`
  - provider-specific webhook parsing hook
  - idempotent webhook event storage
  - donation status update by provider reference
  - subscription status sync (`active` / `payment_failed`)
- `GET /api/v1/donations/{reference}`
  - donor-facing donation/subscription status lookup
- `POST /api/v1/subscriptions/{reference}/cancel-request`
  - cancellation/support request capture for recurring subscriptions
- `GET /api/v1/admin/subscriptions`
  - admin visibility endpoint scaffold (protected by admin bearer token)
- `POST /api/v1/auth/sign-up`
  - donor account creation for recurring donors
  - returns donor session token + profile
- `POST /api/v1/auth/sign-in`
  - donor account authentication + session token
- `GET /api/v1/auth/profile`
  - donor profile lookup via bearer token
- `POST /api/v1/admin/login`
  - admin login endpoint returning admin bearer token
  - payload uses `username` + `password` (server-side verification)
- `GET /api/v1/admin/content/{section_key}`
  - fetch editable draft content block
- `PUT /api/v1/admin/content/{section_key}`
  - save editable draft content block
- SQLite persistence for:
  - donors
  - donations
  - subscriptions
  - webhook events
  - donor accounts + sessions
  - admin users + sessions
  - admin content drafts

## What still needs merchant credentials/live setup

- Populate `backend/.env` from `backend/.env.example`.
- Finalize provider adapter request-signing/body mapping in:
  - `backend/app/providers/paytabs.py`
  - `backend/app/providers/aps.py`
- Add provider-authenticated webhook signature validation rules.
- Replace scaffold admin credentials with secure secrets and rotate regularly.
- Add production-grade observability and retry jobs for failed renewals.

## Security model

- No raw card data is collected or stored by ENF backend.
- Card entry must occur on hosted gateway pages or gateway tokenized elements.
- Secrets are environment-based and never hardcoded.
- Webhooks are stored idempotently and should be signature-verified.

## Run locally

1. Create and activate a Python virtual environment.
2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Copy env template:

```bash
cp backend/.env.example backend/.env
```

4. Start API:

```bash
uvicorn app.main:app --reload --app-dir backend
```

5. Configure admin credentials in the untracked `backend/.env` file:
   - Set `ENF_ADMIN_USERNAME`.
   - Set a strong `ENF_ADMIN_PASSWORD`.
   - Never commit the populated `.env` file.

## Recommended production hardening checklist

1. Put API behind TLS + WAF.
2. Add rate limits on checkout/session endpoints.
3. Add request tracing and failed webhook alerts.
4. Add encrypted backups for donation/subscription DB.
5. Add authenticated admin dashboard for subscription operations.
