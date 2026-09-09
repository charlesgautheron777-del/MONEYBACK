# MONEYBACK automation map

Workers are designed to be triggered by an external scheduler/cron once enabled in production.

Pipeline:
1. outbound-send — sends due initial/follow-up emails and stops after 3 follow-ups.
2. resend-inbound — records inbound events and opt-outs.
3. lead-qualification-worker — converts positive replies into qualified leads.
4. conversion-worker — creates/updates recovery opportunities.
5. closing-worker — creates the €490 Stripe checkout for qualified leads.
6. stripe-webhook — marks paid deals and creates the audit job.
7. audit-worker — processes paid audit jobs.

Human intervention should be reserved for exceptional cases, legal/compliance decisions, supplier negotiations, and final recovery actions requiring authorization.
