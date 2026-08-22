"use client";

import Link from "next/link";
import { useState } from "react";
import { SPEECH_RATES, updateSettings, useSettings } from "@/lib/settings";
import { speak } from "@/lib/speech";
import { deleteAccountData, signOut, useAccount } from "@/lib/account";
import { useSpokenGuidance } from "@/hooks/useSpokenGuidance";

const SAMPLE =
  "This is how Trace will read the board to you. The teacher has written the quadratic formula.";

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="grid cursor-pointer gap-2 border-b border-line py-7 sm:grid-cols-[1fr_2fr] sm:gap-8">
      <span className="flex items-center gap-4">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-6 w-6 accent-[var(--foreground)]"
        />
        <span className="text-2xl font-semibold tracking-tight">{label}</span>
      </span>
      <span className="max-w-xl text-base leading-7 text-muted">{description}</span>
    </label>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const account = useAccount();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useSpokenGuidance(
    "Settings. You can change how fast Trace reads to you, turn vibration " +
      "and spoken guidance on or off, and manage your account.",
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
      <p className="text-sm text-muted">
        <Link href="/" className="underline hover:no-underline">
          Your classes
        </Link>
      </p>
      <h1 className="mt-1 text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
        Settings
      </h1>

      <section aria-labelledby="reading" className="mt-14">
        <h2
          id="reading"
          className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase"
        >
          Reading speed
        </h2>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted">
          How fast Trace speaks. If you already use a screen reader at high
          speed, you probably want this higher than it starts.
        </p>

        <fieldset className="mt-6 border-t border-line pt-6">
          <legend className="sr-only">Reading speed</legend>
          <div className="flex flex-wrap gap-3">
            {SPEECH_RATES.map((rate) => (
              <label
                key={rate}
                className={`cursor-pointer border-2 px-5 py-3 text-lg font-medium ${
                  settings.speechRate === rate
                    ? "border-line bg-foreground text-background"
                    : "border-line-soft hover:border-line"
                }`}
              >
                <input
                  type="radio"
                  name="speech-rate"
                  className="sr-only"
                  aria-label={
                    rate === 1 ? "Normal speed" : `${rate} times normal speed`
                  }
                  checked={settings.speechRate === rate}
                  onChange={() => {
                    updateSettings({ speechRate: rate });
                    speak(SAMPLE);
                  }}
                />
                {rate}&times;
              </label>
            ))}
          </div>
        </fieldset>
        <button
          onClick={() => speak(SAMPLE)}
          className="mt-6 border-2 border-line px-6 py-4 text-lg font-semibold hover:bg-surface"
        >
          Hear a sample
        </button>
      </section>

      <section aria-labelledby="feedback" className="mt-16">
        <h2
          id="feedback"
          className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase"
        >
          Feedback
        </h2>
        <div className="mt-6 border-t border-line">
          <Toggle
            label="Vibration"
            checked={settings.haptics}
            onChange={(haptics) => updateSettings({ haptics })}
            description="Buzz your phone when the board changes. Useful when Trace is
              still mid-sentence on the last update, or when the room is loud.
              Two buzzes means the board was wiped."
          />
          <Toggle
            label="Spoken guidance"
            checked={settings.spokenGuidance}
            onChange={(spokenGuidance) => updateSettings({ spokenGuidance })}
            description="Read each screen's instructions aloud when you arrive on it.
              Turn this off if you use your own screen reader and don't want
              two voices at once."
          />
        </div>
      </section>

      <section aria-labelledby="account" className="mt-16">
        <h2
          id="account"
          className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase"
        >
          Account
        </h2>
        {account.status === "signed-in" ? (
          <>
            <p className="mt-4 text-lg leading-8">
              Signed in as{" "}
              <strong className="font-semibold">{account.username}</strong>.
              Your classes sync to any device you sign in on.
            </p>
            <p className="mt-2 text-base leading-7 text-muted">
              {account.syncing
                ? "Saving…"
                : account.error
                  ? account.error
                  : account.lastSyncedAt
                    ? `Last saved at ${new Date(account.lastSyncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
                    : "Everything is saved."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => void signOut()}
                className="border-2 border-line px-6 py-4 text-lg font-semibold hover:bg-surface"
              >
                Sign out
              </button>
              {confirmingDelete ? (
                <>
                  <button
                    onClick={() => {
                      void deleteAccountData();
                      setConfirmingDelete(false);
                      speak("Your classes have been deleted.");
                    }}
                    className="border-2 border-live bg-live px-6 py-4 text-lg font-semibold text-background"
                  >
                    Yes, delete every class
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="px-2 text-lg text-muted underline hover:no-underline"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="border-2 border-line-soft px-6 py-4 text-lg font-semibold hover:border-line"
                >
                  Delete all my classes
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 max-w-xl text-lg leading-8">
              You&apos;re using Trace without an account. Everything works, and
              every class stays on this device.
            </p>
            <p className="mt-2 max-w-xl text-base leading-7 text-muted">
              Add a name and a PIN if you want your classes on more than one
              device — a school laptop and your phone, say.
            </p>
            <Link
              href="/account"
              className="mt-6 inline-block border-2 border-line bg-foreground px-6 py-4 text-lg font-semibold text-background hover:bg-muted"
            >
              Set up an account
            </Link>
          </>
        )}
      </section>

      <section aria-labelledby="data" className="mt-16 border-t-2 border-line pt-8">
        <h2
          id="data"
          className="font-mono text-xs font-medium tracking-[0.15em] text-muted uppercase"
        >
          Where your data goes
        </h2>
        <ul className="mt-5 max-w-2xl space-y-4 text-base leading-7">
          <li className="border-l-2 border-line-soft pl-4">
            <strong className="font-semibold">Without an account</strong>, your
            classes never leave this device. They&apos;re stored in this
            browser and nowhere else.
          </li>
          <li className="border-l-2 border-line-soft pl-4">
            <strong className="font-semibold">Camera frames</strong> are sent to
            the vision model that reads the board (Qwen2.5-VL, run by Nebius AI
            Studio) while a class is running. That&apos;s the only third party
            Trace talks to, and only while you&apos;re in a class.
          </li>
          <li className="border-l-2 border-line-soft pl-4">
            <strong className="font-semibold">Live audio</strong> is transcribed
            by your own browser&apos;s speech recognition. Trace never records
            or stores the audio itself.
          </li>
          <li className="border-l-2 border-line-soft pl-4">
            <strong className="font-semibold">With an account</strong>, your
            saved classes are also kept on Trace&apos;s server so they follow
            you between devices. Your PIN is never stored — only a salted
            PBKDF2 hash of it, which can&apos;t be turned back into your PIN.
            Five wrong PINs locks the account for fifteen minutes.
          </li>
          <li className="border-l-2 border-line-soft pl-4">
            <strong className="font-semibold">Signing out</strong> clears every
            class off this device, so a shared school laptop doesn&apos;t keep
            your work. <strong className="font-semibold">Delete all my
            classes</strong> erases them from the server too, permanently.
          </li>
          <li className="border-l-2 border-line-soft pl-4">
            There are no analytics, no trackers, and no ads anywhere in Trace.
          </li>
        </ul>
      </section>
    </div>
  );
}
