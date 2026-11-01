import { NextRequest, NextResponse } from "next/server";
import { findArbitrage, findValueOpportunities, type OutcomeOdds } from "@/lib/odds/engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      outcomes?: OutcomeOdds[];
      modelProbabilities?: Record<string, number>;
    };
    if (!Array.isArray(body.outcomes) || !body.modelProbabilities) {
      return NextResponse.json(
        { error: "Send outcomes og modelProbabilities." },
        { status: 400 }
      );
    }
    const opportunities = findValueOpportunities(body.outcomes, body.modelProbabilities);
    const arbitrage = findArbitrage(body.outcomes);
    return NextResponse.json({ opportunities, arbitrage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukendt fejl";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
