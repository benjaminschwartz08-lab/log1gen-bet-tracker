export type OutcomeOdds = { outcome: string; bookmaker: string; odds: number };

export type ValueOpportunity = {
  outcome: string;
  bookmaker: string;
  odds: number;
  modelProbability: number;
  impliedProbability: number;
  fairProbability: number | null;
  evPercent: number;
  fairOdds: number;
};

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

export function calculateExpectedValue(
  modelProbability: number,
  decimalOdds: number
): number {
  if (!Number.isFinite(modelProbability) || modelProbability < 0 || modelProbability > 1) {
    throw new Error("Model-sandsynlighed skal være mellem 0 og 1.");
  }
  return modelProbability * decimalOdds - 1;
}

export function findValueOpportunities(
  outcomes: OutcomeOdds[],
  modelProbabilities: Record<string, number>
): ValueOpportunity[] {
  const groups = new Map<string, OutcomeOdds[]>();
  for (const item of outcomes) {
    const group = groups.get(item.bookmaker) ?? [];
    group.push(item);
    groups.set(item.bookmaker, group);
  }

  const fairByOutcome = new Map<string, number>();
  for (const group of groups.values()) {
    const fair = removeVig(group.map((item) => item.odds));
    group.forEach((item, index) => {
      const current = fairByOutcome.get(item.outcome);
      // Average normalized probabilities across available bookmakers.
      fairByOutcome.set(item.outcome, (current ?? 0) + fair[index] / groups.size);
    });
  }

  return outcomes.flatMap((item) => {
    const probability = modelProbabilities[item.outcome];
    if (probability === undefined) return [];
    const fairProbability = fairByOutcome.get(item.outcome) ?? null;
    return [{
      outcome: item.outcome,
      bookmaker: item.bookmaker,
      odds: item.odds,
      modelProbability: probability,
      impliedProbability: impliedProbability(item.odds),
      fairProbability,
      evPercent: calculateExpectedValue(probability, item.odds) * 100,
      fairOdds: fairProbability && fairProbability > 0 ? 1 / fairProbability : 0,
    }];
  }).sort((a, b) => b.evPercent - a.evPercent);
}

export function findArbitrage(outcomes: OutcomeOdds[]) {
  const best = new Map<string, OutcomeOdds>();
  for (const item of outcomes) {
    if (!Number.isFinite(item.odds) || item.odds <= 1) continue;
    const current = best.get(item.outcome);
    if (!current || item.odds > current.odds) best.set(item.outcome, item);
  }
  const selections = [...best.values()];
  if (selections.length < 2) return null;
  const impliedTotal = selections.reduce((sum, item) => sum + 1 / item.odds, 0);
  if (impliedTotal >= 1) return null;
  const stakes = selections.map((item) => ({
    ...item,
    stakePercent: (1 / item.odds) / impliedTotal * 100,
  }));
  return {
    selections: stakes,
    profitPercent: (1 / impliedTotal - 1) * 100,
    impliedTotal,
  };
}
