# Live odds setup

The scanner requests live prices through a server route. The provider API key is never sent to the browser.

## Configure the key

1. Create an account with The Odds API and copy your API key.
2. In Netlify, open the site's environment variables.
3. Add `ODDS_API_KEY` with the key as its value.
4. Trigger a new deployment.
5. For local development, add the same variable to `.env.local` (do not commit that file).

Do not use a `NEXT_PUBLIC_` prefix for this key.

## Current coverage

The first live feed currently exposes these provider sport keys in the UI:
- NBA: `basketball_nba`
- MLB: `baseball_mlb`
- NHL: `icehockey_nhl`
- NFL: `americanfootball_nfl`
- English Premier League: `soccer_epl`
- MLS: `soccer_usa_mls`

The server route also has a provider key for ATP French Open tennis, but tennis is not yet exposed in the UI. The route requests h2h, spreads and totals markets in decimal odds for the EU region. Actual bookmaker and market availability depends on the provider, region, event and API plan. The UI shows the provider's remaining request quota when supplied.

## Scanner behaviour

- Live event cards now calculate the highest listed price for each outcome across the bookmakers returned by the provider.
- Where the same market and selections are available across bookmakers, the scanner checks the best prices for a possible arbitrage and displays the theoretical percentage.
- EV calculations use your supplied model probabilities. The engine scopes fair-probability calculations by event, market, line and bookmaker so unrelated markets are not mixed.
- The CLV helper in `src/lib/odds/clv.ts` compares taken odds with closing odds. Positive CLV means the price you took was better than the closing price. It is a calculation helper only; it does not yet save closing prices or automatically populate bets.

## Important limitations

- Live odds are not available until `ODDS_API_KEY` is configured.
- This is not yet an all-sports feed. Additional leagues and sports need provider sport keys and market coverage.
- Best-price comparison only compares the markets and lines returned by the provider. Different handicap/total lines must not be treated as equivalent.
- Arbitrage figures are theoretical. Confirm that every selection is the same event, market, line, settlement rule and currency, and account for limits, void rules, fees and price movement before acting.
- Odds snapshots are not yet automatically ingested. A schema foundation exists, but a scheduled server-side importer and secure service-role setup are still required.
- No automated alerts, model-generated probabilities or automatic closing-line capture are included yet.
- Check the bookmaker's current price and market rules before placing a bet. Prices can change between refreshes.

## Supabase odds history migration

A starter schema is included at `supabase/migrations/202611010001_odds_snapshots.sql`. Run it in the Supabase SQL Editor to create the historical snapshot table and authenticated read policy. Browser-side inserts are deliberately disabled; a future scheduled/server-side importer should use a server-only Supabase service-role key.
