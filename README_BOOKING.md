Automating SportyBet booking locally

This repository includes a small helper script to post a SportyBet payload from a logged-in browser context so you can obtain a valid share code.

Important: This script opens a real browser and requires you to log in to SportyBet manually. It does not store or transmit credentials.

Prerequisites
- Node.js 18+
- `npm install playwright` (you may install browser binaries via `npx playwright install`)

Usage
1. Provide the SportyBet booking code you want to optimize (e.g. `X60VQ9`).
2. Run the automation script; it will open a browser where you should log in to SportyBet:

```bash
npm install
npx playwright install
node ./scripts/automateSportybet.mjs X60VQ9 --max-odds=30
```

Options:
- `--max-odds=NUMBER` — remove highest-odds legs until combined odds <= NUMBER
- `--min-survival=NUMBER` — remove highest-odds legs until survival probability (%) >= NUMBER

3. After logging in, press Enter in the terminal. The script will fetch the original booking code from SportyBet, apply the optimization heuristics, submit the optimized payload from your logged-in session, and print the SportyBet response including the `shareCode` if successful.

Notes
- The script uses the in-browser origin `/api/ng/orders/share` so your SportyBet session cookies are used.
- If SportyBet rejects the payload, the script prints the response for inspection. You can re-run with different options.
- This runs locally in a headed browser; credentials stay on your machine.
