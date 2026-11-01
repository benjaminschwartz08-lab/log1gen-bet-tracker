"use client";

import { useState } from "react";

type Result = {
  opportunities: Array<{ outcome: string; bookmaker: string; odds: number; modelProbability: number; impliedProbability: number; fairProbability: number | null; evPercent: number; fairOdds: number }>;
  arbitrage: null | { profitPercent: number; selections: Array<{ outcome: string; bookmaker: string; odds: number; stakePercent: number }> };
};
type LiveEvent = {
  id: string; sport: string; commenceTime: string; homeTeam: string; awayTeam: string;
  bookmakers: Array<{ key: string; name: string; lastUpdate: string; markets: Array<{ key: string; outcomes: Array<{ name: string; odds: number; point: number | null }> }> }>;
};
type LiveResponse = { configured: boolean; message?: string; error?: string; events: LiveEvent[]; quota?: { remaining: string | null; used: string | null } };

const SPORTS = [
  { key: "basketball_nba", label: "NBA" },
  { key: "baseball_mlb", label: "MLB" },
  { key: "icehockey_nhl", label: "NHL" },
  { key: "americanfootball_nfl", label: "NFL" },
  { key: "soccer_epl", label: "Premier League" },
  { key: "soccer_usa_mls", label: "MLS" },
];

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
  const [sport, setSport] = useState(SPORTS[0].key);
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [liveError, setLiveError] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);

  async function scan() {
    setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/odds/ev", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomes: [{ outcome: outcomeA, bookmaker, odds: Number(oddsA) }, { outcome: outcomeB, bookmaker, odds: Number(oddsB) }],
          modelProbabilities: { [outcomeA]: Number(probA) / 100, [outcomeB]: Number(probB) / 100 },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Scanner kunne ikke beregne værdier.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Der opstod en fejl."); }
    finally { setLoading(false); }
  }

  async function loadLiveOdds() {
    setLiveLoading(true); setLiveError(""); setLive(null);
    try {
      const response = await fetch(`/api/odds?sport=${encodeURIComponent(sport)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Live-odds kunne ikke hentes.");
      setLive(data);
      if (data.error) setLiveError(data.error);
    } catch (e) { setLiveError(e instanceof Error ? e.message : "Der opstod en fejl."); }
    finally { setLiveLoading(false); }
  }

  function useLivePrice(eventItem: LiveEvent, bookmakerName: string, outcomeName: string, price: number, otherOutcome?: string, otherPrice?: number) {
    setEvent(`${eventItem.homeTeam} vs. ${eventItem.awayTeam}`);
    setBookmaker(bookmakerName);
    setOutcomeA(outcomeName); setOddsA(String(price));
    if (otherOutcome && otherPrice) { setOutcomeB(otherOutcome); setOddsB(String(otherPrice)); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const field = "w-full rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-3 text-white outline-none focus:border-emerald-500";
  const marketLabel = (key: string) => key === "h2h" ? "1X2 / Moneyline" : key === "totals" ? "Over/Under" : key === "spreads" ? "Handicap" : key;

  return (
    <main className="min-h-screen bg-[#07090d] p-5 text-white md:p-8">
      <div className="mx-auto max-w-6xl">
        <a href="/" className="text-sm text-emerald-400 hover:text-emerald-300">← Tilbage til dashboard</a>
        <div className="mb-8 mt-5">
          <p className="text-sm text-emerald-400">EDGEBOOK / TOOLS</p>
          <h1 className="mt-2 text-3xl font-bold">+EV Scanner</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Sammenlign live-odds og beregn forventet værdi ud fra dine egne sandsynligheder. Live-data kræver en API-nøgle fra oddsudbyderen.</p>
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
            <p className="mt-4 text-xs text-zinc-500">Brug dine egne modelchancer. For et komplet marked bør sandsynlighederne tilsammen være cirka 100 %.</p>
            <button onClick={scan} disabled={loading || !outcomeA.trim() || !outcomeB.trim()} className="mt-6 w-full rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50">{loading ? "Beregner..." : "Beregn +EV"}</button>
            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#10141c] p-6">
            <h2 className="mb-5 text-lg font-semibold">Resultater</h2>
            {!result && <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">Dine beregninger vises her, når du scanner markedet.</div>}
            {result && <>
              <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">{event || "Dit marked"}</p>
              <div className="space-y-3">
                {result.opportunities.map(item => <div key={item.outcome + item.bookmaker} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{item.outcome}</span><span className={item.evPercent > 0 ? "font-semibold text-emerald-400" : "font-semibold text-red-400"}>{item.evPercent >= 0 ? "+" : ""}{item.evPercent.toFixed(2)}% EV</span></div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-400">
                    <span>Odds: <b className="text-white">{item.odds.toFixed(2)}</b></span><span>Fair odds: <b className="text-white">{item.fairOdds.toFixed(2)}</b></span>
                    <span>Model chance: <b className="text-white">{(item.modelProbability * 100).toFixed(1)}%</b></span><span>Implied: <b className="text-white">{(item.impliedProbability * 100).toFixed(1)}%</b></span>
                  </div>
                </div>)}
              </div>
              {result.arbitrage && <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="font-semibold text-emerald-400">Mulig arbitrage: +{result.arbitrage.profitPercent.toFixed(2)}%</p>
                {result.arbitrage.selections.map(s => <p key={s.outcome} className="mt-2 text-sm text-zinc-300">{s.outcome} · {s.bookmaker} · odds {s.odds.toFixed(2)} · indsatsfordeling {s.stakePercent.toFixed(1)}%</p>)}
              </div>}
              <p className="mt-4 text-xs text-zinc-500">EV er beregnet ud fra dine indtastede modelchancer og er ikke en garanti for gevinst.</p>
            </>}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#10141c] p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><p className="text-sm text-emerald-400">LIVE DATA</p><h2 className="mt-1 text-xl font-semibold">Odds feed</h2><p className="mt-1 text-sm text-zinc-500">Vælg sport og hent aktuelle markeder fra tilsluttet oddsudbyder.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select value={sport} onChange={e => setSport(e.target.value)} className={field + " sm:min-w-52"}>
                {SPORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button onClick={loadLiveOdds} disabled={liveLoading} className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-200 disabled:opacity-50">{liveLoading ? "Henter..." : "Hent live-odds"}</button>
            </div>
          </div>
          {liveError && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{liveError}</p>}
          {live?.configured === false && <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">{live.message}<p className="mt-2 text-xs text-zinc-400">Gratis adgang og antal kald afhænger af udbyderens aktuelle plan og kvoter.</p></div>}
          {live?.configured && <div className="mt-5">
            <div className="mb-4 flex flex-wrap justify-between gap-2 text-xs text-zinc-500"><span>{live.events.length} events fundet · The Odds API</span><span>Requests tilbage: {live.quota?.remaining ?? "Ikke oplyst"}</span></div>
            {live.events.length === 0 && <p className="rounded-lg border border-white/10 p-5 text-sm text-zinc-400">Ingen kommende events med disse markeder lige nu.</p>}
            <div className="space-y-4">
              {live.events.map(item => <article key={item.id} className="rounded-xl border border-white/10 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{item.homeTeam} <span className="text-zinc-500">vs.</span> {item.awayTeam}</h3><p className="mt-1 text-xs text-zinc-500">{new Date(item.commenceTime).toLocaleString("da-DK")}</p></div><span className="text-xs text-zinc-500">{item.bookmakers.length} bookmakere</span></div>
                {item.bookmakers.map(book => <div key={book.key} className="mt-3 border-t border-white/5 pt-3">
                  <p className="mb-2 text-xs font-medium text-emerald-400">{book.name}</p>
                  {book.markets.map(market => <div key={market.key} className="mb-2">
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">{marketLabel(market.key)}</p>
                    <div className="flex flex-wrap gap-2">
                      {market.outcomes.map(outcome => <button key={outcome.name + outcome.point} onClick={() => useLivePrice(item, book.name, outcome.name, outcome.odds)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left text-xs hover:border-emerald-500/50"><span className="block text-zinc-400">{outcome.name}{outcome.point !== null ? ` ${outcome.point > 0 ? "+" : ""}${outcome.point}` : ""}</span><b className="mt-1 block text-sm text-white">{outcome.odds.toFixed(2)}</b><span className="mt-1 block text-[10px] text-emerald-400">Brug odds</span></button>)}
                    </div>
                  </div>)}
                </div>)}
              </article>)}
            </div>
          </div>}
        </section>
      </div>
    </main>
  );
}
