import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId er påkrævet." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Du skal være logget ind for at se odds-historik." }, { status: 401 });

  const marketKey = request.nextUrl.searchParams.get("market");
  const outcomeName = request.nextUrl.searchParams.get("outcome");
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 500);
  const limit = Number.isFinite(rawLimit) ? Math.min(1000, Math.max(1, Math.floor(rawLimit))) : 500;

  let query = supabase.from("odds_snapshots")
    .select("event_id,sport_key,home_team,away_team,bookmaker_key,bookmaker_title,market_key,outcome_name,outcome_point,decimal_odds,captured_at")
    .eq("event_id", eventId)
    .order("captured_at", { ascending: true })
    .limit(limit);
  if (marketKey) query = query.eq("market_key", marketKey);
  if (outcomeName) query = query.eq("outcome_name", outcomeName);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Kunne ikke hente odds-historik.", detail: error.message }, { status: 500 });

  return NextResponse.json({ eventId, count: data?.length ?? 0, snapshots: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
