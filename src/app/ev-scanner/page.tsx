"use client";

import { useState } from "react";

type Result = {
  opportunities: Array<{
    outcome: string;
    bookmaker: string;
    odds: number;
    modelProbability: number;
    impliedProbability: number;
    fairProbability: number | null;
    evPercent: number;
    fairOdds: number;
  }>;
  arbitrage: null | {
    profitPercent: number;
    selections: Array<{ outcome: string; bookmaker: string; odds: number; stakePercent: number }>;
  };
};

export default function EVScannerPage() {
  const [event, setEvent] = useState("");
  const [outcomeA, setOutcomeA] = useState("Home");
  const [outcomeB, setOutcomeB] = useState("Away");
  const [oddsA, setOddsA] = useState("2.10");
  const [oddsB, setOddsB] = useState("1.85");
  const [bookmaker, setBookmaker] = useState("Bookmaker");
  const [probA, setProbA] = useState("50");
  const [probB, setProbB] = useState("50");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function scan() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/odds/ev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomes: [
            { outcome: outcomeA, bookmaker, odds: Number(oddsA) },
            { outcome: outcomeB, bookmaker, odds: Number(oddsB) },
          ],
          modelProbabilities: {
            [outcomeA]: Number(probA) / 100,
            [outcomeB]: Number(probB) / 100,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Scanner kunne ikke beregne værdier.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der opstod en fejl.");
    } finally {
      setLoading(false);
    }
  }

  const field = "w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-3 text-white outline-none focus:border-emerald-500";

  return (
    <main className="min-h-screen bg-[#07090d] p-5 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        <a href="/" className="text-sm text-emerald-400 hover:text-emerald-300">← Tilbage til dashboard</a>
        <div className="mb-8 mt-5">
          <p className="text-sm text-emerald-400">EDGEBOOK / TOOLS</p>
          <h1 className="mt-2 text-3xl font-bold">+EV Scanner</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Indtast odds fra en bookmaker og dine egne sandsynligheder. Scanneren beregner forventet værdi, fair odds og potentiel arbitrage.</p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-2xl border border-white/10 bg-[#10141c] p-6">
            <h2 className="mb-5 text-lg font-semibold">Marked og model</h2>
            <label className="mb-4 block text-sm text-zinc-400">Event
              <input className={field + " mt-2"} value={event} onChange={e => setEvent(e.target.value)} placeholder="Fx Arsenal vs. Chelsea" />
            </label>
            <label className="mb-4 block text-sm text-zinc-400">Bookmaker
              <input className={field + " mt-2"} value={bookmaker} onChange={e => setBookmaker(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-zinc-400">Udfald 1</label>
                <input className={field + " mt-2"} value={outcomeA} onChange={e => setOutcomeA(e.target.value)} />
                <label className="mt-3 block text-sm text-zinc-400">Odds</label>
                <input className={field + " mt-2"} type="number" min="1.01" step="0.01" value={oddsA} onChange={e => setOddsA(e.target.value)} />
                <label className="mt-3 block text-sm text-zinc-400">Model chance (%)</label>
                <input className={field + " mt-2"} type="number" min="0" max="100" step="0.1" value={probA} onChange={e => setProbA(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-zinc-400">Udfald 2</label>
                <input className={field + " mt-2"} value={outcomeB} onChange={e => setOutcomeB(e.target.value)} />
                <label className="mt-3 block text-sm text-zinc-400">Odds</label>
                <input className={field + " mt-2"} type="number" min="1.01" step="0.01" value={oddsB} onChange={e => setOddsB(e.target.value)} />
                <label className="mt-3 block text-sm text-zinc-400">Model chance (%)</label>
                <input className={field + " mt-2"} type="number" min="0" max="100" step="0.1" value={probB} onChange={e => setProbB(e.target.value)} />
              </div>
            </div>
            <p className="mt-4 text-xs text-zinc-500">Model-sandsynlighederne behøver ikke summeres til 100 %, men bør gøre det for et komplet marked.</p>
            <button onClick={scan} disabled={loading || !outcomeA.trim() || !outcomeB.trim()} className="mt-6 w-full rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50">
              {loading ? "Beregner..." : "Beregn +EV"}
            </button>
            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#10141c] p-6">
            <h2 className="mb-5 text-lg font-semibold">Resultater</h2>
            {!result && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">Dine beregninger vises her, når du scanner markedet.</div>}
            {result && <>
              <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">{event || "Dit marked"}</p>
              <div className="space-y-3">
                {result.opportunities.map((item, index) => (
                  <div key={item.outcome + item.bookmaker} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.outcome}</span>
                      <span className={item.evPercent > 0 ? "font-semibold text-emerald-400" : "font-semibold text-red-400"}>{item.evPercent >= 0 ? "+" : ""}{item.evPercent.toFixed(2)}% EV</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-400">
                      <span>Odds: <b className="text-white">{item.odds.toFixed(2)}</b></span>
                      <span>Fair odds: <b className="text-white">{item.fairOdds.toFixed(2)}</b></span>
                      <span>Model chance: <b className="text-white">{(item.modelProbability * 100).toFixed(1)}%</b></span>
                      <span>Implied: <b className="text-white">{(item.impliedProbability * 100).toFixed(1)}%</b></span>
                    </div>
                  </div>
                ))}
              </div>
              {result.arbitrage && <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="font-semibold text-emerald-400">Mulig arbitrage: +{result.arbitrage.profitPercent.toFixed(2)}%</p>
                {result.arbitrage.selections.map(s => <p key={s.outcome} className="mt-2 text-sm text-zinc-300">{s.outcome} · {s.bookmaker} · odds {s.odds.toFixed(2)} · indsatsfordeling {s.stakePercent.toFixed(1)}%</p>)}
              </div>}
              <p className="mt-4 text-xs text-zinc-500">EV er beregnet ud fra dine indtastede modelchancer. Det er ikke en garanti for gevinst.</p>
            </>}
          </div>
        </section>
      </div>
    </main>
  );
}
