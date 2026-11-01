import { findArbitrage, type OutcomeOdds } from "./engine";

export type LiveEventForComparison = {
  id: string; sport: string; commenceTime: string; homeTeam: string; awayTeam: string;
  bookmakers: Array<{ key: string; name: string; markets: Array<{ key: string; outcomes: Array<{ name: string; odds: number; point: number | null }> }> }>;
};

export function compareEventMarkets(event: LiveEventForComparison) {
  const grouped = new Map<string, Map<string, Array<{ bookmaker: string; odds: number; point: number | null }>>>();
  for (const book of event.bookmakers) {
    for (const market of book.markets) {
      for (const outcome of market.outcomes) {
        const marketId = market.key + "|" + (outcome.point ?? "");
        const selections = grouped.get(marketId) ?? new Map();
        const offers = selections.get(outcome.name) ?? [];
        offers.push({ bookmaker: book.name, odds: outcome.odds, point: outcome.point });
        selections.set(outcome.name, offers);
        grouped.set(marketId, selections);
      }
    }
  }

  const bestMarkets = [...grouped.entries()].map(([marketId, selections]) => {
    const marketKey = marketId.split("|")[0];
    const outcomes = [...selections.entries()].map(([name, offers]) => {
      const sorted = [...offers].sort((a, b) => b.odds - a.odds);
      return { name, offers: sorted, best: sorted[0] };
    });
    const arbInputs: OutcomeOdds[] = outcomes.map((item) => ({
      eventId: event.id, marketKey, point: item.best.point,
      outcome: item.name, bookmaker: item.best.bookmaker, odds: item.best.odds,
    }));
    const rawArbitrage = findArbitrage(arbInputs);
    const arbitrage = Array.isArray(rawArbitrage) ? rawArbitrage[0] ?? null : rawArbitrage;
    return { marketKey, point: marketId.split("|")[1] || null, outcomes, arbitrage };
  });
  return { bestMarkets };
}
