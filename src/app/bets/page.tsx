"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function BetsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("All");
  const [resultFilter, setResultFilter] = useState("All");
  const [bookmakerFilter, setBookmakerFilter] = useState("All");

  useEffect(() => {
    let cancelled = false;

    async function loadBets() {
      setLoading(true);
      setErrorMessage("");

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
        .select(
          "id, sport, event, market, bookmaker, odds, stake, result, created_at"
        )
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error(error);
        setErrorMessage(`Kunne ikke hente bets: ${error.message}`);
        setBets([]);
      } else {
        setBets(
          (data ?? []).map((bet) => ({
            id: bet.id,
            sport: bet.sport,
            event: bet.event,
            market: bet.market,
            bookmaker: bet.bookmaker,
            odds: Number(bet.odds),
            stake: Number(bet.stake),
            result: bet.result as BetResult,
            createdAt: bet.created_at,
          }))
        );
      }

      setLoading(false);
    }

    loadBets();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const sports = useMemo(
    () => [...new Set(bets.map((bet) => bet.sport))].sort(),
    [bets]
  );

  const bookmakers = useMemo(
    () => [...new Set(bets.map((bet) => bet.bookmaker))].sort(),
    [bets]
  );

  const filteredBets = useMemo(() => {
    return bets.filter((bet) => {
      const searchableText = [
        bet.sport,
        bet.event,
        bet.market,
        bet.bookmaker,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(search.toLowerCase());
      const matchesSport =
        sportFilter === "All" || bet.sport === sportFilter;
      const matchesResult =
        resultFilter === "All" || bet.result === resultFilter;
      const matchesBookmaker =
        bookmakerFilter === "All" ||
        bet.bookmaker === bookmakerFilter;

      return (
        matchesSearch &&
        matchesSport &&
        matchesResult &&
        matchesBookmaker
      );
    });
  }, [bets, search, sportFilter, resultFilter, bookmakerFilter]);

  const totalStake = filteredBets.reduce(
    (total, bet) => total + bet.stake,
    0
  );

  const totalProfit = filteredBets.reduce(
    (total, bet) => total + calculateProfit(bet),
    0
  );

  const settledBets = filteredBets.filter(
    (bet) => bet.result === "Win" || bet.result === "Loss"
  );

  const wins = settledBets.filter((bet) => bet.result === "Win").length;

  const roi =
    totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;

  const hitRate =
    settledBets.length > 0 ? (wins / settledBets.length) * 100 : 0;

  async function updateResult(id: string, result: BetResult) {
    const previousBets = bets;

    setBets((current) =>
      current.map((bet) =>
        bet.id === id ? { ...bet, result } : bet
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
    if (!window.confirm("Vil du slette dette bet permanent?")) {
      return;
    }

    const previousBets = bets;

    setBets((current) =>
      current.filter((bet) => bet.id !== id)
    );

    const { error } = await supabase
      .from("bets")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setBets(previousBets);
      alert(`Bettet kunne ikke slettes: ${error.message}`);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function resetFilters() {
    setSearch("");
    setSportFilter("All");
    setResultFilter("All");
    setBookmakerFilter("All");
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
            <Link
              href="/"
              className="block rounded-lg px-4 py-3 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              Dashboard
            </Link>

            <Link
              href="/bets"
              className="block rounded-lg bg-emerald-500 px-4 py-3 text-sm font-medium text-black"
            >
              Bet Tracker
            </Link>

            {[
              "EV Tools",
              "Tennis Lab",
              "MLB Lab",
              "NBA Props",
              "CLV Engine",
              "Analytics",
              "Settings",
            ].map((item) => (
              <button
                type="button"
                key={item}
                className="w-full rounded-lg px-4 py-3 text-left text-sm text-zinc-500"
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 p-5 md:p-8">
          <header className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm text-zinc-500">
                Administration
              </p>
              <h2 className="text-3xl font-bold">Bet Tracker</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Se, filtrér og administrér alle dine bets.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-white/10 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
              >
                Log ud
              </button>

              <Link
                href="/"
                className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
              >
                + Add Bet
              </Link>
            </div>
          </header>

          {errorMessage && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Viste bets"
              value={filteredBets.length.toString()}
            />
            <StatCard
              label="Samlet stake"
              value={formatMoney(totalStake)}
            />
            <StatCard
              label="Profit/Loss"
              value={formatMoney(totalProfit)}
              positive={totalProfit >= 0}
            />
            <StatCard
              label="ROI / Hit Rate"
              value={`${roi.toFixed(1).replace(".", ",")}% / ${hitRate
                .toFixed(1)
                .replace(".", ",")}%`}
              positive={roi >= 0}
            />
          </div>

          <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#10141c]">
            <div className="border-b border-white/10 p-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Søg event, marked..."
                  className="filter-input xl:col-span-2"
                />

                <select
                  value={sportFilter}
                  onChange={(event) =>
                    setSportFilter(event.target.value)
                  }
                  className="filter-input"
                >
                  <option value="All">Alle sportsgrene</option>
                  {sports.map((sport) => (
                    <option key={sport} value={sport}>
                      {sport}
                    </option>
                  ))}
                </select>

                <select
                  value={bookmakerFilter}
                  onChange={(event) =>
                    setBookmakerFilter(event.target.value)
                  }
                  className="filter-input"
                >
                  <option value="All">Alle bookmakere</option>
                  {bookmakers.map((bookmaker) => (
                    <option key={bookmaker} value={bookmaker}>
                      {bookmaker}
                    </option>
                  ))}
                </select>

                <select
                  value={resultFilter}
                  onChange={(event) =>
                    setResultFilter(event.target.value)
                  }
                  className="filter-input"
                >
                  <option value="All">Alle resultater</option>
                  <option value="Pending">Pending</option>
                  <option value="Win">Win</option>
                  <option value="Loss">Loss</option>
                  <option value="Void">Void</option>
                </select>
              </div>

              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 text-sm text-zinc-500 transition hover:text-emerald-400"
              >
                Nulstil filtre
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-zinc-500">
                Henter dine bets...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px] text-left text-sm">
                  <thead className="bg-white/[0.02] text-zinc-500">
                    <tr>
                      <th className="px-5 py-4 font-medium">Dato</th>
                      <th className="px-5 py-4 font-medium">Sport</th>
                      <th className="px-5 py-4 font-medium">Event</th>
                      <th className="px-5 py-4 font-medium">Marked</th>
                      <th className="px-5 py-4 font-medium">
                        Bookmaker
                      </th>
                      <th className="px-5 py-4 font-medium">Odds</th>
                      <th className="px-5 py-4 font-medium">Stake</th>
                      <th className="px-5 py-4 font-medium">
                        Resultat
                      </th>
                      <th className="px-5 py-4 font-medium">
                        Profit
                      </th>
                      <th className="px-5 py-4 font-medium">
                        Handling
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredBets.map((bet) => {
                      const profit = calculateProfit(bet);

                      return (
                        <tr
                          key={bet.id}
                          className="border-t border-white/5 transition hover:bg-white/[0.02]"
                        >
                          <td className="px-5 py-4 text-zinc-500">
                            {formatDate(bet.createdAt)}
                          </td>
                          <td className="px-5 py-4">{bet.sport}</td>
                          <td className="px-5 py-4 font-medium">
                            {bet.event}
                          </td>
                          <td className="px-5 py-4 text-zinc-400">
                            {bet.market}
                          </td>
                          <td className="px-5 py-4 text-zinc-400">
                            {bet.bookmaker}
                          </td>
                          <td className="px-5 py-4">
                            {bet.odds.toFixed(2)}
                          </td>
                          <td className="px-5 py-4">
                            {formatMoney(bet.stake)}
                          </td>
                          <td className="px-5 py-4">
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
                            className={`px-5 py-4 font-semibold ${
                              profit > 0
                                ? "text-emerald-400"
                                : profit < 0
                                ? "text-red-400"
                                : "text-zinc-500"
                            }`}
                          >
                            {formatMoney(profit)}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => deleteBet(bet.id)}
                              className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 transition hover:bg-red-500/20"
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
                  <div className="p-12 text-center text-zinc-500">
                    Ingen bets matcher dine valgte filtre.
                  </div>
                )}
              </div>
            )}
          </article>
        </section>
      </div>

      <style jsx global>{`
        .filter-input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: #0b0e14;
          padding: 0.75rem 1rem;
          color: white;
          outline: none;
        }

        .filter-input:focus {
          border-color: rgb(16 185 129);
        }

        .filter-input::placeholder {
          color: rgb(82 82 91);
        }
      `}</style>
    </main>
  );
}

function StatCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#10141c] p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          positive === false
            ? "text-red-400"
            : positive === true
            ? "text-emerald-400"
            : ""
        }`}
      >
        {value}
      </p>
    </article>
  );
}