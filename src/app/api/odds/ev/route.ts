import { NextRequest, NextResponse } from "next/server";
import { findArbitrage, findValueOpportunities, type OutcomeOdds } from "@/lib/odds/engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { outcomes?: OutcomeOdds[]; modelProbabilities?: Record<string, number> };
    if (!Array.isArray(body.outcomes) || !body.modelProbabilities || typeof body.modelProbabilities !== "object") {
      return NextResponse.json({ error: "Send outcomes og modelProbabilities." }, { status: 400 });
    }
    if (body.outcomes.length > 1000) return NextResponse.json({ error: "For mange odds i én beregning." }, { status: 413 });
    const opportunities = findValueOpportunities(body.outcomes, body.modelProbabilities);
    const arbitrage = findArbitrage(body.outcomes);
    return NextResponse.json({ opportunities, arbitrage });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ukendt fejl" }, { status: 400 });
  }
}
