"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage(
          "Din bruger er oprettet. Tjek din e-mail og bekræft kontoen."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        router.push("/");
        router.refresh();
      }
    } catch {
      setMessage("Der opstod en uventet fejl. Prøv igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07090d] p-4 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#10141c] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Log1gen</h1>
          <p className="mt-1 text-emerald-400">Bet Tracker Pro</p>

          <h2 className="mt-8 text-2xl font-semibold">
            {mode === "login" ? "Log ind" : "Opret bruger"}
          </h2>

          <p className="mt-2 text-sm text-zinc-500">
            {mode === "login"
              ? "Log ind for at se dine bets."
              : "Opret din personlige bettingkonto."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-zinc-400">
              E-mail
            </span>

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="din@email.dk"
              className="w-full rounded-xl border border-white/10 bg-[#0b0e14] px-4 py-3 outline-none transition placeholder:text-zinc-700 focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-zinc-400">
              Adgangskode
            </span>

            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mindst 6 tegn"
              className="w-full rounded-xl border border-white/10 bg-[#0b0e14] px-4 py-3 outline-none transition placeholder:text-zinc-700 focus:border-emerald-500"
            />
          </label>

          {message && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-300">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Vent..."
              : mode === "login"
              ? "Log ind"
              : "Opret bruger"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
          className="mt-6 w-full text-sm text-zinc-400 transition hover:text-emerald-400"
        >
          {mode === "login"
            ? "Har du ingen konto? Opret bruger"
            : "Har du allerede en konto? Log ind"}
        </button>
      </section>
    </main>
  );
}