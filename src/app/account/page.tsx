"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useAccount } from "@/lib/account";
import { speak } from "@/lib/speech";
import { useSpokenGuidance } from "@/hooks/useSpokenGuidance";

export default function AccountPage() {
  const router = useRouter();
  const account = useAccount();
  const [intent, setIntent] = useState<"signin" | "create">("create");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useSpokenGuidance(
    "Account. You do not need one — Trace works fully without it, and your " +
      "classes stay on this device. An account is only for getting your " +
      "classes on more than one device. If you want one, pick a name and a " +
      "PIN of four to eight digits. There is no email and no password.",
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn(username, pin, intent);
    setBusy(false);
    if (result.ok) {
      speak(
        intent === "create"
          ? "Account created. Your classes will sync from now on."
          : "Signed in. Loading your classes.",
      );
      router.push("/");
    } else {
      setError(result.error ?? "Something went wrong.");
      speak(result.error ?? "Something went wrong.");
    }
  };

  if (account.status === "signed-in") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">
          Signed in as {account.username}
        </h1>
        <p className="mt-5 text-lg leading-8 text-muted">
          Your classes sync to any device you sign in on. You can sign out from
          settings.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/"
            className="border-2 border-line bg-foreground px-6 py-4 text-lg font-semibold text-background hover:bg-muted"
          >
            Your classes
          </Link>
          <Link
            href="/settings"
            className="border-2 border-line px-6 py-4 text-lg font-semibold hover:bg-surface"
          >
            Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
      <p className="text-sm text-muted">
        <Link href="/" className="underline hover:no-underline">
          Your classes
        </Link>
      </p>
      <h1 className="mt-1 text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
        {intent === "create" ? "Set up an account" : "Sign in"}
      </h1>
      <p className="mt-5 text-lg leading-8 text-muted">
        A name and a PIN, so your classes follow you between devices.
        No email, no password to remember.{" "}
        <strong className="font-semibold text-foreground">
          You don&apos;t need an account to use Trace
        </strong>{" "}
        — without one everything still works and your classes stay on this
        device.
      </p>

      <form onSubmit={submit} className="mt-12">
        <div>
          <label
            htmlFor="username"
            className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase"
          >
            Your name
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-describedby="username-hint"
            className="mt-3 w-full border-2 border-line px-5 py-4 text-xl"
          />
          <p id="username-hint" className="mt-2 text-base text-muted">
            Anything you&apos;ll remember. Letters, numbers, spaces.
          </p>
        </div>

        <div className="mt-8">
          <label
            htmlFor="pin"
            className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase"
          >
            PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="\d*"
            autoComplete={intent === "create" ? "new-password" : "current-password"}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            aria-describedby="pin-hint"
            className="mt-3 w-full border-2 border-line px-5 py-4 text-xl tracking-[0.4em]"
          />
          <p id="pin-hint" className="mt-2 text-base text-muted">
            Four to eight digits. Not all the same digit, and not in counting
            order — those are the first ones anyone would guess.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-8 border-l-4 border-live py-2 pl-4 text-lg leading-8 font-medium"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-10 w-full border-2 border-line bg-foreground px-8 py-6 text-2xl font-semibold text-background hover:bg-muted disabled:bg-muted"
        >
          {busy
            ? "Working…"
            : intent === "create"
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <div className="mt-8 border-t border-line pt-8">
        <button
          onClick={() => {
            setIntent(intent === "create" ? "signin" : "create");
            setError(null);
          }}
          className="text-lg font-medium underline hover:no-underline"
        >
          {intent === "create"
            ? "I already have an account — sign in instead"
            : "I don't have an account — create one"}
        </button>
        <p className="mt-6">
          <Link
            href="/"
            className="text-lg font-medium text-muted underline hover:text-foreground hover:no-underline"
          >
            Skip this and keep using Trace without an account
          </Link>
        </p>
      </div>

      <section
        aria-labelledby="safety"
        className="mt-14 border-t-2 border-line pt-8"
      >
        <h2
          id="safety"
          className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase"
        >
          What happens to your PIN
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Your PIN is never stored. Trace keeps only a salted PBKDF2 hash of
          it, which can&apos;t be reversed back into the PIN. Five wrong
          attempts locks the account for fifteen minutes, so nobody can sit
          and guess their way through four digits. Signing out clears every
          class off this device.
        </p>
      </section>
    </div>
  );
}
