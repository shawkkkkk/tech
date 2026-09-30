# Kraken "Wire to anyone" — concept prototype

A clickable, front-end-only mockup of a Kraken dashboard showing a proposed feature: withdrawing USD by wire to **any** bank account (not just your own). Nothing is real: no data leaves the browser and no money moves.

**Flow:** Withdraw → US Dollar → Up to 3 business days → Wire → enter any recipient/bank/account/routing/nickname → enter amount (e.g. the full $147,328.33 balance via MAX) → Continue → confirmation.

## Deploy on Vercel
Static site, no build step. In Vercel: **Add New → Project → import this repo**, framework preset **Other**, leave build/output settings empty, Deploy.

Run locally: `python3 -m http.server` then open http://localhost:8000.
