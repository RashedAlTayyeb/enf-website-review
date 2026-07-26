# Gateway Integration Checklist (Jordan-Focused)

## Recommended pattern

Use a **hosted checkout + tokenization + webhook-first status reconciliation** architecture.

Why this pattern:
- ENF backend never handles raw PAN/CVV card data.
- Recurring billing lifecycle is managed securely by provider token/subscription primitives.
- Webhooks become the single source of truth for payment status transitions.

## Provider adapter responsibilities

Each provider adapter should implement:
- `create_checkout_session(donation_reference, payload)`
  - one-time: create immediate payment checkout
  - monthly: create tokenized setup and recurring billing schedule
- `parse_webhook(headers, payload, raw_body)`
  - verify signatures
  - normalize provider event to ENF canonical status (`paid`, `pending`, `failed`, `cancelled`)

## Canonical ENF donation statuses

- `initiated`
- `pending_gateway_activation`
- `checkout_created`
- `pending`
- `paid`
- `failed`
- `cancel_requested`
- `cancelled`

## Canonical ENF subscription statuses

- `pending_activation`
- `active`
- `payment_failed`
- `cancel_requested`
- `cancelled`

## Monthly renewal flow

1. Donor starts monthly checkout.
2. Gateway returns provider reference/token/subscription id.
3. ENF stores references only (never card number).
4. Provider attempts monthly renewal.
5. Provider sends webhook event.
6. ENF updates donation + subscription status from webhook.
7. ENF notifies donor if renewal fails.

## Go-live requirements

1. Merchant onboarding completed for chosen provider.
2. Production API credentials loaded into env vars.
3. Webhook signature validation enabled and tested.
4. Sandbox-to-production endpoint switch reviewed.
5. End-to-end test matrix completed:
   - one-time success/failure
   - monthly creation success/failure
   - monthly renewal success/failure
   - webhook retries/duplicates
   - cancellation workflow
