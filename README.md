# MONEYBACK 2.6.0

MONEYBACK RECOVERY — B2B invoice/contract recovery MVP.

## Cash chain
1. Prospect enters the B2B funnel.
2. Screening identifies a potential recovery amount.
3. Commercial proposal routes to the pilot audit.
4. `create-checkout` creates Stripe Checkout server-side.
5. Stripe webhook verifies payment and marks the deal paid.
6. Client uploads invoice data through a token-scoped audit job.
7. A secret-authenticated worker claims pending jobs and runs `process-audit`.
8. Report is generated and becomes available through the token-scoped status endpoint.
9. Worker retries failed jobs up to three attempts.

## Production requirements
- Stripe secret + webhook secret
- MONEYBACK worker secret
- Supabase server-side secret
- production URLs
- pg_cron/pg_net scheduler activation

Never expose server secrets in browser code or commit them to Git.

## Verification
`npm run verify` runs the deterministic project checks.
