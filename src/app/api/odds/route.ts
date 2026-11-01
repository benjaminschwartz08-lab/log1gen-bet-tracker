import { NextRequest, NextResponse } from "next/server";

const SPORTS: Record<string, string> = {
  basketball_nba: "NBA",
  baseball_mlb: "MLB",
  icehockey_nhl: "NHL",
  americanfootball_nfl: "NFL",
  soccer_epl: "Premier League",
  soccer_usa_mls: "MLS",
  tennis_atp_french_open: "Tennis (ATP French Open)",
};

type ProviderOutcome = { name: string; price: number; point?: number };
type ProviderMarket = { key: string; outcomes: ProviderOutcome[] };
type ProviderBookmaker = { key: string; title: string; last_update: string; markets: ProviderMarket[] };
type ProviderEvent = {
  id: string; sport_key: string; sport_title: string; commence_time: string;
  home_team: string; away_team: string; bookmakers: ProviderBookmaker[];
};

export async function GET(request: NextRequest) {
  const sport = request.nextUrl.searchParams.get("sport") ?? "basketball_nba";
  if (!Object.hasOwn(SPORTS, sport)) {
    return NextResponse.json({ error: "Denne sportsgren er ikke understøttet endnu." }, { status: 400 });
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      provider: "The Odds API",
      message: "Tilføj ODDS_API_KEY i projektets server environment variables for at hente live-odds. Nøglen skal aldrig ligge i browseren.",
      supportedSports: Object.entries(SPORTS).map(([key, label]) => ({ key, label })),
      events: [],
    }, { status: 200 });
  }

  const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds/`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "eu");
  url.searchParams.set("markets", "h2h,spreads,totals");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");

  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({
        error: response.status === 401 ? "Odds API-nøglen blev afvist." :
          response.status === 422 ? "Udbyderen understøtter ikke denne sport/markedkombination." :
          `Odds-udbyderen svarede med status ${response.status}.`,
        providerStatus: response.status,
        detail: detail.slice(0, 300),
      }, { status: response.status === 401 ? 502 : 502 });
    }

    const data = await response.json() as ProviderEvent[];
    const events = data.map((event) => ({
      id: event.id,
      sport: event.sport_title,
      commenceTime: event.commence_time,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      bookmakers: event.bookmakers.map((bookmaker) => ({
        key: bookmaker.key,
        name: bookmaker.title,
        lastUpdate: bookmaker.last_update,
        markets: bookmaker.markets.map((market) => ({
          key: market.key,
          outcomes: market.outcomes.map((outcome) => ({
            name: outcome.name,
            odds: outcome.price,
            point: outcome.point ?? null,
          })),
        })),
      })),
    }));

    return NextResponse.json({
      configured: true,
      provider: "The Odds API",
      sport,
      events,
      quota: {
        remaining: response.headers.get("x-requests-remaining"),
        used: response.headers.get("x-requests-used"),
        last: response.headers.get("x-requests-last"),
      },
    }, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    return NextResponse.json({ error: "Kunne ikke hente odds lige nu. Prøv igen senere." }, { status: 502 });
  }
}
