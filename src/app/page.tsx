"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type BetResult = "Pending" | "Win" | "Loss" | "Void";

type Bet = {
  id: string;
  sport: string;
  event: string;
  market: string;
  bookmaker: string;
  odds: number;
  stake: number;
  result: BetResult;
  createdAt: string;
};

type BetForm = {
  sport: string;
  event: string;
  market: string;
  bookmaker: string;
  odds: string;
  stake: string;
  result: BetResult;
};

const STARTING_BANKROLL = 10000;

const emptyForm: BetForm = {
  sport: "Tennis",
  event: "",
  market: "",
  bookmaker: "Bet365",
  odds: "",
  stake: "",
  result: "Pending",
};

function calculateProfit(bet: Bet) {
  if (bet.result === "Win") {
    return bet.stake * (bet.odds - 1);
  }

  if (bet.result === "Loss") {
    return -bet.stake;
  }

  return 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;
}

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoadingBets, setIsLoadingBets] = useState(true);
  const [databaseError, setDatabaseError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BetForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("All");

  useEffect(() => {
  let cancelled = false;

  async function loadBets() {
    setIsLoadingBets(true);
    setDatabaseError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsLoadingBets(false);
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("bets")
      .select(
        "id, sport, event, market, bookmaker, odds, stake, result, created_at"
      )
      .order("created_at", { ascending: false });

    if (cancelled) return;

    if (error) {
      console.error(error);
      setDatabaseError(`Kunne ikke hente bets: ${error.message}`);
      setBets([]);
    } else {
      const databaseBets: Bet[] = (data ?? []).map((bet) => ({
        id: bet.id,
        sport: bet.sport,
        event: bet.event,
        market: bet.market,
        bookmaker: bet.bookmaker,
        odds: Number(bet.odds),
        stake: Number(bet.stake),
        result: bet.result as BetResult,
        createdAt: bet.created_at,
      }));

      setBets(databaseBets);
    }

    setIsLoadingBets(false);
  }

  loadBets();

  return () => {
    cancelled = true;
  };
}, [router, supabase]);

  const settledBets = bets.filter(
    (bet) => bet.result === "Win" || bet.result === "Loss"
  );

  const totalProfit = settledBets.reduce(
    (total, bet) => total + calculateProfit(bet),
    0
  );

  const totalStake = settledBets.reduce(
    (total, bet) => total + bet.stake,
    0
  );

  const wins = settledBets.filter((bet) => bet.result === "Win").length;

  const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
  const hitRate =
    settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;
  const bankroll = STARTING_BANKROLL + totalProfit;

  const filteredBets = useMemo(() => {
    return bets.filter((bet) => {
      const matchesSearch = [
        bet.event,
        bet.market,
        bet.bookmaker,
        bet.sport,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesSport =
        sportFilter === "All" || bet.sport === sportFilter;

      return matchesSearch && matchesSport;
    });
  }, [bets, search, sportFilter]);

  const chartValues = useMemo(() => {
    let cumulative = 0;

    const values = [...bets]
      .reverse()
      .filter((bet) => bet.result !== "Pending")
      .map((bet) => {
        cumulative += calculateProfit(bet);
        return cumulative;
      });

    if (values.length === 0) {
      return [0];
    }

    return values;
  }, [bets]);

  const maxChartValue = Math.max(
    ...chartValues.map((value) => Math.abs(value)),
    1
  );

  const stats = [
    {
      label: "Bankroll",
      value: formatMoney(bankroll),
    },
    {
      label: "Profit/Loss",
      value: formatMoney(totalProfit),
      positive: totalProfit >= 0,
    },
    {
      label: "ROI",
      value: formatPercent(roi),
      positive: roi >= 0,
    },
    {
      label: "CLV",
      value: "Kommer snart",
    },
    {
      label: "Yield",
      value: formatPercent(roi),
      positive: roi >= 0,
    },
    {
      label: "Hit Rate",
      value: `${hitRate.toFixed(1).replace(".", ",")}%`,
    },
  ];

  function updateForm<K extends keyof BetForm>(
    field: K,
    value: BetForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function addBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const odds = Number(form.odds.replace(",", "."));
    const stake = Number(form.stake.replace(",", "."));

    if (
      !form.event.trim() ||
      !form.market.trim() ||
      !Number.isFinite(odds) ||
      !Number.isFinite(stake) ||
      odds <= 1 ||
      stake <= 0
    ) {
      alert("Udfyld event, marked, odds og stake korrekt.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    const { data, error } = await supabase
      .from("bets")
      .insert({
        user_id: user.id,
        sport: form.sport,
        event: form.event.trim(),
        market: form.market.trim(),
        bookmaker: form.bookmaker.trim() || "Ukendt",
        odds,
        stake,
        result: form.result,
      })
      .select(
        "id, sport, event, market, bookmaker, odds, stake, result, created_at"
      )
      .single();

    if (error) {
      console.error(error);
      alert(`Bet kunne ikke gemmes: ${error.message}`);
      return;
    }

    const newBet: Bet = {
      id: data.id,
      sport: data.sport,
      event: data.event,
      market: data.market,
      bookmaker: data.bookmaker,
      odds: Number(data.odds),
      stake: Number(data.stake),
      result: data.result as BetResult,
      createdAt: data.created_at,
    };

    setBets((current) => [newBet, ...current]);
    setForm(emptyForm);
    setShowForm(false);
  }

  async function updateResult(id: string, result: BetResult) {
    const previousBets = bets;

    setBets((current) =>
      current.map((bet) =>
        bet.id === id
          ? {
              ...bet,
              result,
            }
          : bet
      )
    );

    const { error } = await supabase
      .from("bets")
      .update({ result })
      .eq("id", id);

    if (error) {
      console.error(error);
      setBets(previousBets);
      alert(`Resultatet kunne ikke opdateres: ${error.message}`);
    }
  }

  async function deleteBet(id: string) {
    const confirmed = window.confirm("Vil du slette dette bet?");

    if (!confirmed) return;

    const previousBets = bets;
    setBets((current) => current.filter((bet) => bet.id !== id));

    const { error } = await supabase.from("bets").delete().eq("id", id);

    if (error) {
      console.error(error);
      setBets(previousBets);
      alert(`Bettet kunne ikke slettes: ${error.message}`);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0b0e14] p-6 lg:block">
          <h1 className="mb-10 text-2xl font-bold">
            Log1gen
            <span className="block text-sm font-normal text-emerald-400">
              Bet Tracker Pro
            </span>
          </h1>

          <nav className="space-y-2">
  {[
    "Dashboard",
    "Bet Tracker",
    "EV Tools",
    "Tennis Lab",
    "MLB Lab",
    "NBA Props",
    "CLV Engine",
    "Analytics",
    "Settings",
  ].map((item, index) => (
    <button
      key={item}
      className={`w-full rounded-lg px-4 py-3 text-left text-sm transition ${
        index === 0
          ? "bg-emerald-500 text-black"
          : "text-zinc-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      {item}
    </button>
  ))}
</nav>
        </aside>

        <section className="min-w-0 flex-1 p-5 md:p-8">
          <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm text-zinc-500">Overview</p>
              <h2 className="text-3xl font-bold">Dashboard</h2>
            </div>

            <div className="flex gap-3">
  <button
    onClick={signOut}
    className="rounded-lg border border-white/10 px-5 py-3 font-medium text-zinc-300 transition hover:bg-white/5"
  >
    Log ud
  </button>

  <button
    onClick={() => setShowForm(true)}
    className="rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400"
  >
    + Add Bet
  </button>
</div>
          </header>

          {databaseError && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {databaseError}
            </div>
          )}

          {isLoadingBets && (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
              Henter dine bets...
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-[#10141c] p-5 shadow-lg"
              >
                <p className="text-sm text-zinc-500">{stat.label}</p>

                <p
                  className={`mt-2 text-3xl font-bold ${
                    stat.positive === false
                      ? "text-red-400"
                      : stat.positive === true
                      ? "text-emerald-400"
                      : ""
                  }`}
                >
                  {stat.value}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
            <article className="rounded-2xl border border-white/10 bg-[#10141c] p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">Performance</p>
                  <h3 className="text-xl font-semibold">
                    Profit Development
                  </h3>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-sm ${
                    roi >= 0
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {formatPercent(roi)}
                </span>
              </div>

              <div className="flex h-64 items-end gap-2">
                {chartValues.map((value, index) => {
                  const height =
                    15 + (Math.abs(value) / maxChartValue) * 85;

                  return (
                    <div
                      key={`${value}-${index}`}
                      title={formatMoney(value)}
                      className={`min-w-2 flex-1 rounded-t transition ${
                        value >= 0
                          ? "bg-gradient-to-t from-emerald-800 to-emerald-400"
                          : "bg-gradient-to-t from-red-900 to-red-400"
                      }`}
                      style={{
                        height: `${height}%`,
                      }}
                    />
                  );
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-[#10141c] p-6">
              <p className="text-sm text-zinc-500">Current overview</p>
              <h3 className="text-xl font-semibold">Quick Stats</h3>

              <div className="mt-6 space-y-5">
                <QuickStat
                  label="Active bets"
                  value={bets.length.toString()}
                  progress={Math.min(bets.length * 10, 100)}
                />

                <QuickStat
                  label="Settled bets"
                  value={settledBets.length.toString()}
                  progress={
                    bets.length > 0
                      ? (settledBets.length / bets.length) * 100
                      : 0
                  }
                />

                <QuickStat
                  label="Wins"
                  value={wins.toString()}
                  progress={hitRate}
                />
              </div>
            </article>
          </div>

          <article className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#10141c]">
            <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-6 lg:flex-row lg:items-center">
              <div>
                <p className="text-sm text-zinc-500">Bet history</p>
                <h3 className="text-xl font-semibold">Bet Tracker</h3>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Søg efter event, marked..."
                  className="rounded-lg border border-white/10 bg-[#0b0e14] px-4 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-500"
                />

                <select
                  value={sportFilter}
                  onChange={(event) => setSportFilter(event.target.value)}
                  className="rounded-lg border border-white/10 bg-[#0b0e14] px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
                >
                  <option value="All">Alle sportsgrene</option>
                  <option value="Tennis">Tennis</option>
                  <option value="MLB">MLB</option>
                  <option value="NBA">NBA</option>
                  <option value="Football">Football</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-white/[0.02] text-zinc-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Sport</th>
                    <th className="px-6 py-4 font-medium">Event</th>
                    <th className="px-6 py-4 font-medium">Market</th>
                    <th className="px-6 py-4 font-medium">Bookmaker</th>
                    <th className="px-6 py-4 font-medium">Odds</th>
                    <th className="px-6 py-4 font-medium">Stake</th>
                    <th className="px-6 py-4 font-medium">Result</th>
                    <th className="px-6 py-4 font-medium">Profit</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBets.map((bet) => {
                    const profit = calculateProfit(bet);

                    return (
                      <tr key={bet.id} className="border-t border-white/5">
                        <td className="px-6 py-4">{bet.sport}</td>
                        <td className="px-6 py-4">{bet.event}</td>
                        <td className="px-6 py-4 text-zinc-400">
                          {bet.market}
                        </td>
                        <td className="px-6 py-4 text-zinc-400">
                          {bet.bookmaker}
                        </td>
                        <td className="px-6 py-4">
                          {bet.odds.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          {formatMoney(bet.stake)}
                        </td>

                        <td className="px-6 py-4">
                          <select
                            value={bet.result}
                            onChange={(event) =>
                              updateResult(
                                bet.id,
                                event.target.value as BetResult
                              )
                            }
                            className={`rounded-full border-0 px-3 py-1 text-xs font-medium outline-none ${
                              bet.result === "Win"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : bet.result === "Loss"
                                ? "bg-red-500/10 text-red-400"
                                : bet.result === "Void"
                                ? "bg-zinc-500/10 text-zinc-400"
                                : "bg-yellow-500/10 text-yellow-400"
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Win">Win</option>
                            <option value="Loss">Loss</option>
                            <option value="Void">Void</option>
                          </select>
                        </td>

                        <td
                          className={`px-6 py-4 font-medium ${
                            profit > 0
                              ? "text-emerald-400"
                              : profit < 0
                              ? "text-red-400"
                              : "text-zinc-400"
                          }`}
                        >
                          {formatMoney(profit)}
                        </td>

                        <td className="px-6 py-4">
                          <button
                            onClick={() => deleteBet(bet.id)}
                            className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition hover:bg-red-500/20"
                          >
                            Slet
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredBets.length === 0 && (
                <div className="p-10 text-center text-zinc-500">
                  Ingen bets matcher din søgning.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#10141c] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm text-emerald-400">Bet Tracker</p>
                <h2 className="text-2xl font-bold">Tilføj nyt bet</h2>
              </div>

              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg bg-white/5 px-3 py-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={addBet} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Sport">
                  <select
                    value={form.sport}
                    onChange={(event) =>
                      updateForm("sport", event.target.value)
                    }
                    className="form-input"
                  >
                    <option>Tennis</option>
                    <option>MLB</option>
                    <option>NBA</option>
                    <option>Football</option>
                    <option>Other</option>
                  </select>
                </FormField>

                <FormField label="Bookmaker">
                  <input
                    value={form.bookmaker}
                    onChange={(event) =>
                      updateForm("bookmaker", event.target.value)
                    }
                    className="form-input"
                    placeholder="Bet365"
                  />
                </FormField>
              </div>

              <FormField label="Event">
                <input
                  value={form.event}
                  onChange={(event) =>
                    updateForm("event", event.target.value)
                  }
                  className="form-input"
                  placeholder="Eksempel: Sinner vs. Alcaraz"
                />
              </FormField>

              <FormField label="Marked">
                <input
                  value={form.market}
                  onChange={(event) =>
                    updateForm("market", event.target.value)
                  }
                  className="form-input"
                  placeholder="Eksempel: Over 22.5 games"
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Odds">
                  <input
                    value={form.odds}
                    onChange={(event) =>
                      updateForm("odds", event.target.value)
                    }
                    className="form-input"
                    inputMode="decimal"
                    placeholder="1,95"
                  />
                </FormField>

                <FormField label="Stake">
                  <input
                    value={form.stake}
                    onChange={(event) =>
                      updateForm("stake", event.target.value)
                    }
                    className="form-input"
                    inputMode="decimal"
                    placeholder="500"
                  />
                </FormField>

                <FormField label="Resultat">
                  <select
                    value={form.result}
                    onChange={(event) =>
                      updateForm(
                        "result",
                        event.target.value as BetResult
                      )
                    }
                    className="form-input"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Win">Win</option>
                    <option value="Loss">Loss</option>
                    <option value="Void">Void</option>
                  </select>
                </FormField>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-white/10 px-5 py-3 font-medium text-zinc-300 hover:bg-white/5"
                >
                  Annuller
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-black hover:bg-emerald-400"
                >
                  Gem bet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .form-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #0b0e14;
          padding: 0.75rem 1rem;
          color: white;
          outline: none;
        }

        .form-input:focus {
          border-color: rgb(16 185 129);
        }

        .form-input::placeholder {
          color: rgb(82 82 91);
        }
      `}</style>
    </main>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function QuickStat({
  label,
  value,
  progress,
}: {
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span>{value}</span>
      </div>

      <div className="h-2 rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-emerald-500 transition-all"
          style={{
            width: `${Math.max(0, Math.min(progress, 100))}%`,
          }}
        />
      </div>
    </div>
  );
}


