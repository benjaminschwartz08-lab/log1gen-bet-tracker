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

const UNIT_SIZE = 100;

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

export default function CalendarPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const today = new Date();

  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  useEffect(() => {
    async function loadBets() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("bets")
        .select(
          "id, sport, event, market, bookmaker, odds, stake, result, created_at"
        )
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

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

      setLoading(false);
    }

    loadBets();
  }, [router, supabase]);

  function previousMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((year) => year - 1);
    } else {
      setCurrentMonth((month) => month - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((year) => year + 1);
    } else {
      setCurrentMonth((month) => month + 1);
    }
  }

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

  function getDayProfit(day: number) {
    const dayBets = bets.filter((bet) => {
      const date = new Date(bet.createdAt);

      return (
        date.getDate() === day &&
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    });

    const profit = dayBets.reduce(
      (sum, bet) => sum + calculateProfit(bet),
      0
    );

    return {
      bets: dayBets,
      profit,
      units: profit / UNIT_SIZE,
    };
  }

  const calendarDays = [];

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(
      <div
        key={`empty-${i}`}
        className="min-h-[120px] rounded-xl"
      />
    );
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = getDayProfit(day);

    const hasSettledBets = dayData.bets.some(
      (bet) => bet.result === "Win" || bet.result === "Loss"
    );

    const isPositive = dayData.profit > 0;
    const isNegative = dayData.profit < 0;

    calendarDays.push(
      <div
        key={day}
        className={`min-h-[120px] rounded-xl border p-3 transition ${
          isPositive
            ? "border-emerald-500/20 bg-emerald-500/10"
            : isNegative
            ? "border-red-500/20 bg-red-500/10"
            : "border-white/5 bg-[#0b0e14]"
        }`}
      >
        <div className="text-sm text-zinc-400">{day}</div>

        {hasSettledBets && (
          <div className="mt-7">
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

            <p className="mt-2 text-xs text-zinc-500">
              {dayData.bets.length}{" "}
              {dayData.bets.length === 1 ? "bet" : "bets"}
            </p>
          </div>
        )}
      </div>
    );
  }

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
          <header className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">
                Bet Tracker
              </p>
              <h2 className="text-3xl font-bold">
                Calendar
              </h2>
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

          <article className="rounded-2xl border border-white/10 bg-[#10141c] p-5 md:p-7">
            <div className="mb-8 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={previousMonth}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 transition hover:bg-white/5"
              >
                ←
              </button>

              <div className="min-w-[180px] rounded-full border border-white/10 px-5 py-2 text-center font-semibold">
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
                {calendarDays}
              </div>
            )}

            <div className="mt-6 text-sm text-zinc-600">
              1 unit = {UNIT_SIZE} kr.
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}