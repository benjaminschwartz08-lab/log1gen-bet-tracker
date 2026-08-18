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

const months = [
  "Januar",
  "Februar",
  "Marts",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "December",
];

const weekdays = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

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

function formatOdds(value: number) {
  return value.toFixed(2).replace(".", ",");
}

export default function CalendarPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const today = new Date();

  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const [unitSize, setUnitSize] = useState(100);
  const [unitInput, setUnitInput] = useState("100");

  useEffect(() => {
    const savedUnitSize = localStorage.getItem("log1gen-unit-size");

    if (savedUnitSize) {
      const parsed = Number(savedUnitSize);

      if (Number.isFinite(parsed) && parsed > 0) {
        setUnitSize(parsed);
        setUnitInput(String(parsed));
      }
    }
  }, []);

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
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error(error);
        setErrorMessage(`Kunne ikke hente kalenderen: ${error.message}`);
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

  function saveUnitSize() {
    const value = Number(unitInput.replace(",", "."));

    if (!Number.isFinite(value) || value <= 0) {
      alert("Unit-størrelsen skal være større end 0.");
      return;
    }

    setUnitSize(value);
    localStorage.setItem("log1gen-unit-size", String(value));
  }

  function previousMonth() {
    setSelectedDay(null);

    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((year) => year - 1);
    } else {
      setCurrentMonth((month) => month - 1);
    }
  }

  function nextMonth() {
    setSelectedDay(null);

    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((year) => year + 1);
    } else {
      setCurrentMonth((month) => month + 1);
    }
  }

  function goToCurrentMonth() {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDay(null);
  }

  function betsForDay(day: number) {
    return bets.filter((bet) => {
      const date = new Date(bet.createdAt);

      return (
        date.getDate() === day &&
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    });
  }

  function getDayData(day: number) {
    const dayBets = betsForDay(day);

    const settledBets = dayBets.filter(
      (bet) => bet.result === "Win" || bet.result === "Loss"
    );

    const wins = settledBets.filter((bet) => bet.result === "Win").length;
    const losses = settledBets.filter((bet) => bet.result === "Loss").length;
    const pending = dayBets.filter((bet) => bet.result === "Pending").length;

    const profit = dayBets.reduce(
      (sum, bet) => sum + calculateProfit(bet),
      0
    );

    return {
      bets: dayBets,
      settledBets,
      wins,
      losses,
      pending,
      profit,
      units: profit / unitSize,
    };
  }

  const monthBets = useMemo(() => {
    return bets.filter((bet) => {
      const date = new Date(bet.createdAt);

      return (
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    });
  }, [bets, currentMonth, currentYear]);

  const monthStats = useMemo(() => {
    const settled = monthBets.filter(
      (bet) => bet.result === "Win" || bet.result === "Loss"
    );

    const wins = settled.filter((bet) => bet.result === "Win").length;
    const losses = settled.filter((bet) => bet.result === "Loss").length;
    const pending = monthBets.filter((bet) => bet.result === "Pending").length;

    const totalStake = settled.reduce((sum, bet) => sum + bet.stake, 0);

    const profit = settled.reduce(
      (sum, bet) => sum + calculateProfit(bet),
      0
    );

    const roi = totalStake > 0 ? (profit / totalStake) * 100 : 0;

    const winRate =
      settled.length > 0 ? (wins / settled.length) * 100 : 0;

    return {
      bets: monthBets.length,
      settled: settled.length,
      wins,
      losses,
      pending,
      totalStake,
      profit,
      units: profit / unitSize,
      roi,
      winRate,
    };
  }, [monthBets, unitSize]);

  const daysInMonth = new Date(
    currentYear,
    currentMonth + 1,
    0
  ).getDate();

  const firstDayRaw = new Date(
    currentYear,
    currentMonth,
    1
  ).getDay();

  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;

  const selectedDayData =
    selectedDay !== null ? getDayData(selectedDay) : null;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
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
          <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm text-zinc-500">Bet Tracker</p>
              <h2 className="text-3xl font-bold">Calendar</h2>

              <p className="mt-2 text-sm text-zinc-500">
                Se profit og resultater dag for dag.
              </p>
            </div>

            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
            >
              Log ud
            </button>
          </header>

          <div className="mb-8 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-[#10141c] p-2">
            <Link
              href="/bets"
              className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              Overview
            </Link>

            <Link
              href="/bets/calendar"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black"
            >
              Calendar
            </Link>

            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-zinc-500"
            >
              Bets
            </button>

            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-zinc-500"
            >
              Results
            </button>

            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-zinc-500"
            >
              Bankroll
            </button>
          </div>

          {errorMessage && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Monthly Units"
              value={`${monthStats.units > 0 ? "+" : ""}${monthStats.units
                .toFixed(2)
                .replace(".", ",")}u`}
              positive={monthStats.profit >= 0}
            />

            <StatCard
              label="Profit / Loss"
              value={formatMoney(monthStats.profit)}
              positive={monthStats.profit >= 0}
            />

            <StatCard
              label="Record"
              value={`${monthStats.wins}-${monthStats.losses}`}
            />

            <StatCard
              label="Win Rate"
              value={`${monthStats.winRate.toFixed(1).replace(".", ",")}%`}
            />

            <StatCard
              label="ROI"
              value={`${monthStats.roi.toFixed(1).replace(".", ",")}%`}
              positive={monthStats.roi >= 0}
            />
          </div>

          <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-[#10141c] p-5 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium">Unit size</p>
              <p className="mt-1 text-xs text-zinc-500">
                Bruges til at beregne +/- units i kalenderen.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={unitInput}
                onChange={(event) => setUnitInput(event.target.value)}
                inputMode="decimal"
                className="w-28 rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />

              <span className="text-sm text-zinc-500">kr.</span>

              <button
                type="button"
                onClick={saveUnitSize}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-emerald-400"
              >
                Gem
              </button>
            </div>
          </div>

          <article className="rounded-2xl border border-white/10 bg-[#10141c] p-4 md:p-7">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={goToCurrentMonth}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
              >
                Denne måned
              </button>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={previousMonth}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition hover:bg-white/5"
                >
                  ←
                </button>

                <div className="min-w-[190px] rounded-full border border-white/10 px-5 py-2 text-center font-semibold">
                  {months[currentMonth]} {currentYear}
                </div>

                <button
                  type="button"
                  onClick={nextMonth}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition hover:bg-white/5"
                >
                  →
                </button>
              </div>

              <div className="text-sm text-zinc-500">
                {monthStats.bets} bets
              </div>
            </div>

            <div className="mb-3 grid grid-cols-7 gap-2">
              {weekdays.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs uppercase tracking-wider text-zinc-600"
                >
                  {day}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="py-20 text-center text-zinc-500">
                Henter kalender...
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstDay }).map((_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="min-h-[125px] rounded-xl"
                  />
                ))}

                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const dayData = getDayData(day);

                  const isPositive = dayData.profit > 0;
                  const isNegative = dayData.profit < 0;

                  const isToday =
                    day === today.getDate() &&
                    currentMonth === today.getMonth() &&
                    currentYear === today.getFullYear();

                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => {
                        if (dayData.bets.length > 0) {
                          setSelectedDay(day);
                        }
                      }}
                      className={`min-h-[125px] rounded-xl border p-3 text-left transition ${
                        isPositive
                          ? "border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15"
                          : isNegative
                          ? "border-red-500/20 bg-red-500/10 hover:bg-red-500/15"
                          : dayData.bets.length > 0
                          ? "border-yellow-500/10 bg-yellow-500/5 hover:bg-yellow-500/10"
                          : "border-white/5 bg-[#0b0e14] hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                            isToday
                              ? "bg-emerald-500 font-bold text-black"
                              : "text-zinc-400"
                          }`}
                        >
                          {day}
                        </span>

                        {dayData.pending > 0 && (
                          <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-[10px] font-medium text-yellow-400">
                            {dayData.pending} pending
                          </span>
                        )}
                      </div>

                      {dayData.bets.length > 0 && (
                        <div className="mt-4">
                          <p
                            className={`text-lg font-bold ${
                              isPositive
                                ? "text-emerald-400"
                                : isNegative
                                ? "text-red-400"
                                : "text-zinc-400"
                            }`}
                          >
                            {dayData.units > 0 ? "+" : ""}
                            {dayData.units.toFixed(2)}u
                          </p>

                          <div className="mt-3 flex flex-wrap gap-1">
                            {dayData.wins > 0 && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-400">
                                {dayData.wins}W
                              </span>
                            )}

                            {dayData.losses > 0 && (
                              <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400">
                                {dayData.losses}L
                              </span>
                            )}

                            {dayData.bets.length > 0 && (
                              <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-zinc-500">
                                {dayData.bets.length} bets
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        </section>
      </div>

      {selectedDay !== null && selectedDayData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#10141c] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#10141c] p-5">
              <div>
                <p className="text-sm text-zinc-500">
                  {selectedDay}. {months[currentMonth]} {currentYear}
                </p>

                <h3 className="mt-1 text-2xl font-bold">
                  {selectedDayData.units > 0 ? "+" : ""}
                  {selectedDayData.units.toFixed(2)}u
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-3">
              <MiniStat
                label="Profit"
                value={formatMoney(selectedDayData.profit)}
              />

              <MiniStat
                label="Record"
                value={`${selectedDayData.wins}-${selectedDayData.losses}`}
              />

              <MiniStat
                label="Bets"
                value={String(selectedDayData.bets.length)}
              />
            </div>

            <div className="space-y-3 px-5 pb-5">
              {selectedDayData.bets.map((bet) => {
                const profit = calculateProfit(bet);

                return (
                  <div
                    key={bet.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-white/5 bg-[#0b0e14] p-4 md:flex-row md:items-center"
                  >
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-zinc-400">
                          {bet.sport}
                        </span>

                        <ResultBadge result={bet.result} />
                      </div>

                      <p className="font-semibold">{bet.event}</p>

                      <p className="mt-1 text-sm text-zinc-500">
                        {bet.market} · {bet.bookmaker}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-5 text-right">
                      <div>
                        <p className="text-xs text-zinc-600">Odds</p>
                        <p className="mt-1 font-medium">
                          {formatOdds(bet.odds)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-600">Stake</p>
                        <p className="mt-1 font-medium">
                          {formatMoney(bet.stake)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-zinc-600">Profit</p>

                        <p
                          className={`mt-1 font-semibold ${
                            profit > 0
                              ? "text-emerald-400"
                              : profit < 0
                              ? "text-red-400"
                              : "text-zinc-500"
                          }`}
                        >
                          {formatMoney(profit)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
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
          positive === true
            ? "text-emerald-400"
            : positive === false
            ? "text-red-400"
            : ""
        }`}
      >
        {value}
      </p>
    </article>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#0b0e14] p-4">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function ResultBadge({ result }: { result: BetResult }) {
  if (result === "Win") {
    return (
      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
        Win
      </span>
    );
  }

  if (result === "Loss") {
    return (
      <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400">
        Loss
      </span>
    );
  }

  if (result === "Void") {
    return (
      <span className="rounded-full bg-zinc-500/10 px-2 py-1 text-xs font-medium text-zinc-400">
        Void
      </span>
    );
  }

  return (
    <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-400">
      Pending
    </span>
  );
}