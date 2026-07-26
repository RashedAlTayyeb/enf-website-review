# Donation Integration Plan (Next Phase)

## Recommended UX Flow

1. User clicks global `Donate Now` CTA.
2. User selects:
   - Program category
   - Program/service
   - Amount
3. User enters donor details.
4. Front-end sends payload to secure backend endpoint.
5. Backend creates provider payment intent/session.
6. User is redirected to payment gateway.
7. Gateway notifies backend via webhook.
8. Backend verifies signature and updates transaction state.
9. Front-end shows success/failure page with reference number.

## Where To Add Backend APIs

Use `/backend` as the integration layer with endpoints such as:

- `POST /api/donations/intent`
- `POST /api/donations/webhook`
- `GET /api/donations/:reference`

## Data Model (Minimum)

- Donation id/reference
- Program category + service code
- Amount + currency
- Donor contact fields
- Provider transaction id
- Status (`initiated`, `pending`, `paid`, `failed`)
- Timestamps + audit metadata

## Security Requirements

- Server-side amount validation
- Signature verification for webhooks
- Idempotency keys for duplicate callbacks
- CSRF + rate limiting for public endpoints
- Secrets stored only server-side

## Front-End Readiness in This Rebuild

- Dedicated donation page and CTA path implemented
- Form shell and selectable program structure implemented
- Explicit backend separation documented
- Production payment logic intentionally not enabled in this phase
