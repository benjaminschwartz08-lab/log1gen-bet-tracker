# Live odds setup

The scanner uses The Odds API from a server route. The API key is never sent to the browser.

## Configure the key

1. Create an account with The Odds API and copy your API key.
2. In the deployment provider (for example Netlify), open the site's environment variables.
3. Add `ODDS_API_KEY` with the key as its value.
4. Trigger a new deployment.
5. For local development, add the same variable to `.env.local` (do not commit that file).

Do not use a `NEXT_PUBLIC_` prefix for this key.

## Current coverage

The first live feed supports these provider sport keys:
- NBA: `basketball_nba`
- MLB: `baseball_mlb`
- NHL: `icehockey_nhl`
- NFL: `americanfootball_nfl`
- English Premier League: `soccer_epl`
- MLS: `soccer_usa_mls`

The route requests h2h, spreads and totals markets in decimal odds for the EU region. Actual bookmaker and market availability depends on the provider, region, event and API plan. The UI shows the provider's remaining request quota when supplied.

## Important limitations

- Live odds are not available until `ODDS_API_KEY` is configured.
- This is a first feed integration, not a complete all-sports feed. Additional leagues and sports should be added only when the provider confirms their sport keys and market coverage.
- The current scanner lets you transfer a selected live price into the manual EV calculator. Automated model probabilities, cross-book best-price aggregation, persisted odds history, alerts and CLV are separate next steps.
- Check the bookmaker's current price and market rules before placing a bet. Odds can change between refreshes.
