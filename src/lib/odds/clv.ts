import { calculateCLV } from "./engine";

export type CLVRecord = { takenOdds: number; closingOdds: number | null; stake?: number };

/** Positive CLV means the taken price was better than the closing market price. */
export function getBetCLV(record: CLVRecord) {
  if (record.closingOdds == null) return null;
  const result = calculateCLV(record.takenOdds, record.closingOdds);
  return {
    ...result,
    stake: record.stake ?? null,
    status: result.clvPercent > 0 ? "positive" : result.clvPercent < 0 ? "negative" : "neutral",
  } as const;
}
