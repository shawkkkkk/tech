# Kraken-inspired interactive sandbox

A static, browser-local portfolio prototype with working funding, trading, activity, profile controls and transaction support. It is not affiliated with Kraken and does not connect to an exchange, bank or blockchain. Funds, prices, fees, identifiers and arrival estimates are simulated. A visible sandbox label remains on every screen and receipts are marked as simulated.

## Latest behavior

- Starts with a **$65,000.00** USD portfolio. Withdrawing reduces the available balance by the chosen amount plus the sample fee. Canceling a pending withdrawal restores both once.
- Each funding operation, including the starting deposit, generates **FT followed by 17 digits** (19 characters total). The account has a separate, stable **16-character AA-style Public Account ID**. These identifiers are generated locally; they are not issued or recognized by Kraken.
- Includes the **20 historical transaction rows** supplied in the screenshots, preserving their displayed dates, amounts, asset quantities and failed statuses. They are historical snapshots and do not change the current $65,000 starting balance. Exact times, fees and network hashes were not supplied.
- The requested dated wire scenario uses a **3-day wire** with estimated arrival **Wednesday, October 14, 2026**. The configured date is stored on the transaction, including after reload. It is a scenario setting, not a bank processing guarantee or holiday-aware ETA.
- New withdrawals show **Pending**, with **Processing** beneath the pending wire amount. Open any activity row to view its details, copy its funding/account references, download a receipt, ask support, cancel it or simulate confirmation.
- Priority Support accepts an FT reference, an AA account ID (including groups separated by spaces), a sample blockchain hash, or a natural-language question about the latest withdrawal. It returns the transaction date, amount, current status and available arrival estimate. Follow-up questions retain context. AA lookup shows the latest withdrawal; FT lookup selects one transfer. Unknown or ambiguous references do not invent a transaction.
- Chat history and transactions persist in browser storage. Canceled wires have no expected arrival; manually completed wires are identified as sandbox confirmations. Chat answers use the current saved record.
- The interface no longer uses the word requested to be removed. Sandbox markings describe the simulated nature of the prototype.

The AA shape is documented by Kraken: https://support.kraken.com/articles/360028555092-how-to-find-your-account-number-public-account-id-

The 19-character FT shape follows the user's requested example; the official support pages consulted do not establish a universal FT length. Funding references remain distinct from blockchain hashes. Bitcoin examples use 64 hex characters; Ethereum examples use 0x plus 64 hex characters; Solana examples use a signature-shaped base58 value. None is an on-chain record.

## Other working features

Navigation, asset search, chart ranges/hover, watchlists, buy/sell/convert, deposit, cash and crypto withdrawals, configurable bank details, fee-aware MAX, recurring/custom orders, transaction filters/pagination/CSV export, rewards/loans, profile themes/settings, notifications, documents and sign-out/resume.

Full bank account and routing numbers stay in memory. Saved withdrawals contain only the recipient, bank, nickname and masked ending. Use sample details.

## Hosting

This is a buildless static site. Keep `index.html`, `styles.css`, `app.js`, `engine.js` and `favicon.svg` together. For Vercel, use framework preset **Other**, with no build command and no output directory override. In the Sites checkout these files live in `dist/`.

Browser storage uses `kraken-sandbox-v3`. The old v2 storage key is left intact; this new scenario starts at $65,000. Account → Reset returns to the starting scenario. Data is specific to the browser and origin. If storage is blocked, changes last only for the current session.

Existing v3 records migrate on reload: the `OPENING-BALANCE` placeholder becomes a numeric FT reference and the 20 screenshot rows are added once. The migration preserves the current balance, existing withdrawals and support context.

## Validation

Run `node --test tests/*.test.js`. **50 checks passed**, covering ledger accounting and DOM interactions, FT/AA shapes and lookup, exact screenshot history, saved-record migration, Processing wording, fixed wire estimates, follow-up queries, unknown references, cancellation status, safe text rendering and existing application flows.

The DOM harness emulates HTML and events; it does not render CSS. Browser visual QA was unavailable in this environment.
