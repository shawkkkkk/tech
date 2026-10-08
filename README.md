# Kraken "Wire to anyone" — concept prototype

A clickable, front-end-only mockup of a Kraken dashboard showing a proposed feature: withdrawing USD by wire to **any** bank account (not just your own). Nothing is real: no data leaves the browser and no money moves.

**Flow:** Withdraw → US Dollar → 2 business days → Wire → enter any recipient/bank/account/routing/nickname → estimated deposit Friday, October 9, 2026 → enter amount (e.g. the full $189,343.00 balance via MAX) → Continue → confirmation.

## Deploy on Vercel
Static site, no build step. In Vercel: **Add New → Project → import this repo**, framework preset **Other**, leave build/output settings empty, Deploy.

Run locally: `python3 -m http.server` then open http://localhost:8000.
