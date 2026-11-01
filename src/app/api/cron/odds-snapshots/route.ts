import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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
type ProviderEvent = {
  id: string; sport_key: string; sport_title: string; commence_time: string;
  home_team: string; away_team: string;
  bookmakers: Array<{ key: string; title: string; markets: Array<{ key: string; outcomes: ProviderOutcome[] }> }>;
};

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ODDS_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      error: "Mangler ODDS_API_KEY, NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.",
    }, { status: 503 });
  }

  const requestedSport = request.nextUrl.searchParams.get("sport");
  const sports = requestedSport ? [requestedSport] : Object.keys(SPORTS);
  const invalid = sports.find((sport) => !Object.hasOwn(SPORTS, sport));
  if (invalid) return NextResponse.json({ error: `Ukendt sport: ${invalid}` }, { status: 400 });

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const capturedAt = new Date().toISOString();
  const summary: Array<{ sport: string; events: number; snapshots: number; remaining: string | null }> = [];

  for (const sport of sports) {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds/`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", "eu");
    url.searchParams.set("markets", "h2h,spreads,totals");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 250);
      return NextResponse.json({
        error: `Odds-udbyderen fejlede for ${sport} med status ${response.status}.`,
        detail, completed: summary,
      }, { status: 502 });
    }

    const events = await response.json() as ProviderEvent[];
    const rows = events.flatMap((event) => event.bookmakers.flatMap((bookmaker) =>
      bookmaker.markets.flatMap((market) => market.outcomes
        .filter((outcome) => Number.isFinite(outcome.price) && outcome.price > 1)
        .map((outcome) => ({
          event_id: event.id,
          sport_key: event.sport_key || sport,
          sport_title: event.sport_title || SPORTS[sport],
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          bookmaker_key: bookmaker.key,
          bookmaker_title: bookmaker.title,
          market_key: market.key,
          outcome_name: outcome.name,
          outcome_point: outcome.point ?? null,
          decimal_odds: outcome.price,
          captured_at: capturedAt,
          source: "the-odds-api",
        })))
    ));

    for (let offset = 0; offset < rows.length; offset += 500) {
      const { error } = await supabase.from("odds_snapshots").insert(rows.slice(offset, offset + 500));
      if (error) {
        return NextResponse.json({
          error: "Kunne ikke gemme odds snapshots i Supabase.",
          detail: error.message,
          completed: summary,
        }, { status: 500 });
      }
    }

    summary.push({
      sport, events: events.length, snapshots: rows.length,
      remaining: response.headers.get("x-requests-remaining"),
    });
  }

  return NextResponse.json({
    ok: true,
    capturedAt,
    sportsProcessed: summary.length,
    snapshotsSaved: summary.reduce((total, item) => total + item.snapshots, 0),
    results: summary,
  });
}
