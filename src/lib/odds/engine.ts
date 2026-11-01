export type OutcomeOdds = {
  outcome: string;
  bookmaker: string;
  odds: number;
  eventId?: string;
  marketKey?: string;
  point?: number | null;
};

export type ValueOpportunity = {
  outcome: string;
  bookmaker: string;
  odds: number;
  modelProbability: number;
  impliedProbability: number;
  fairProbability: number | null;
  evPercent: number;
  fairOdds: number;
  eventId?: string;
  marketKey?: string;
  point?: number | null;
};

function validateProbability(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Model-sandsynlighed skal være mellem 0 og 1.");
  }
}

export function impliedProbability(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error("Odds skal være et decimaltal større end 1.");
  }
  return 1 / decimalOdds;
}

export function removeVig(odds: number[]): number[] {
  if (odds.length < 2) throw new Error("Et marked skal have mindst to udfald.");
  const implied = odds.map(impliedProbability);
  const total = implied.reduce((sum, value) => sum + value, 0);
  return implied.map((value) => value / total);
}

export function calculateExpectedValue(modelProbability: number, decimalOdds: number): number {
  validateProbability(modelProbability);
  return modelProbability * decimalOdds - 1;
}

const marketId = (item: OutcomeOdds) => [item.eventId ?? "manual", item.marketKey ?? "h2h", item.point ?? ""].join("|");
const selectionId = (item: OutcomeOdds) => [marketId(item), item.outcome].join("|");

export function findValueOpportunities(
  outcomes: OutcomeOdds[],
  modelProbabilities: Record<string, number>
): ValueOpportunity[] {
  const bookmakerMarkets = new Map<string, OutcomeOdds[]>();
  for (const item of outcomes) {
    if (!Number.isFinite(item.odds) || item.odds <= 1) continue;
    const key = marketId(item) + "|" + item.bookmaker;
    bookmakerMarkets.set(key, [...(bookmakerMarkets.get(key) ?? []), item]);
  }

  const fairSums = new Map<string, { total: number; count: number }>();
  for (const group of bookmakerMarkets.values()) {
    if (group.length < 2) continue;
    const fair = removeVig(group.map((item) => item.odds));
    group.forEach((item, index) => {
      const key = selectionId(item);
      const current = fairSums.get(key) ?? { total: 0, count: 0 };
      current.total += fair[index];
      current.count += 1;
      fairSums.set(key, current);
    });
  }

  return outcomes.flatMap((item) => {
    const probability = modelProbabilities[selectionId(item)] ?? modelProbabilities[item.outcome];
    if (probability === undefined || !Number.isFinite(item.odds) || item.odds <= 1) return [];
    validateProbability(probability);
    const fairEntry = fairSums.get(selectionId(item));
    const fairProbability = fairEntry && fairEntry.count ? fairEntry.total / fairEntry.count : null;
    return [{
      outcome: item.outcome, bookmaker: item.bookmaker, odds: item.odds,
      modelProbability: probability, impliedProbability: impliedProbability(item.odds),
      fairProbability, evPercent: calculateExpectedValue(probability, item.odds) * 100,
      fairOdds: fairProbability && fairProbability > 0 ? 1 / fairProbability : 0,
      eventId: item.eventId, marketKey: item.marketKey, point: item.point,
    }];
  }).sort((a, b) => b.evPercent - a.evPercent);
}

export function findArbitrage(outcomes: OutcomeOdds[]) {
  const markets = new Map<string, OutcomeOdds[]>();
  for (const item of outcomes) {
    if (!Number.isFinite(item.odds) || item.odds <= 1) continue;
    const key = marketId(item);
    markets.set(key, [...(markets.get(key) ?? []), item]);
  }

  const opportunities = [...markets.entries()].flatMap(([key, market]) => {
    const best = new Map<string, OutcomeOdds>();
    for (const item of market) {
      const current = best.get(item.outcome);
      if (!current || item.odds > current.odds) best.set(item.outcome, item);
    }
    const selections = [...best.values()];
    if (selections.length < 2) return [];
    const impliedTotal = selections.reduce((sum, item) => sum + 1 / item.odds, 0);
    if (impliedTotal >= 1) return [];
    return [{
      marketId: key, selections: selections.map((item) => ({
        ...item, stakePercent: (1 / item.odds) / impliedTotal * 100,
      })),
      profitPercent: (1 / impliedTotal - 1) * 100, impliedTotal,
    }];
  });
  return opportunities.length === 1 ? opportunities[0] : opportunities;
}

/** Positive CLV means the taken price was better than the closing market price. */
export function calculateCLV(takenOdds: number, closingOdds: number): {
  clvPercent: number; takenImpliedProbability: number; closingImpliedProbability: number;
} {
  const takenImpliedProbability = impliedProbability(takenOdds);
  const closingImpliedProbability = impliedProbability(closingOdds);
  return {
    clvPercent: ((closingOdds / takenOdds) - 1) * 100,
    takenImpliedProbability,
    closingImpliedProbability,
  };
}
