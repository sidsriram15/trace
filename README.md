# Trace

Real-time classroom access for blind students. Point a phone or laptop
camera at a whiteboard before class starts, and Trace watches it, listens
to the lecture, and reads the board out loud as it fills up. Every board
state is kept, including what gets erased, so nothing is lost the moment a
teacher wipes the board — and the whole class can be played back later.

Trace is voice-first throughout: it can be operated end to end without
seeing the screen, without a mouse, and without memorising a keyboard
layout.

Built for the [Suvidha AI Virtual Hackathon 2026](https://suvidha-hackathon.vercel.app).

## The barrier this removes

A blind student in a normal classroom has no reliable way to follow what's
written on a whiteboard. Screen readers don't see whiteboards. A note-taker
or aide isn't always available, and even when one is, erased board content
and the connection between "what's spoken" and "what's written" are usually
lost. Trace turns a phone camera into that missing channel, live, without
anyone else in the room needing to do anything differently.

## How it works

1. **Home is your classes.** The home page organizes past classes into
   folders (by subject, or however you like) plus an "Unsorted" bucket for
   anything not filed away.
2. **Starting a class** goes through a clear intro screen (`/new`) before
   any camera turns on — pick or create a folder, optionally name the
   class, and confirm you're ready. The screen speaks its own instructions
   on load, including a warning that the browser is about to show a camera
   and microphone permission prompt, since that prompt is purely visual and
   Trace can't speak for it.
3. **Capture.** Once a class begins, the browser grabs a camera frame every
   few seconds and does a cheap client-side pixel-diff against the last
   frame it analyzed, so it only calls the model when the board actually
   looks different (or every 30s regardless, in case slow handwriting never
   trips the diff).
4. **Understand.** Changed frames go to a vision-language model
   (`Qwen/Qwen2.5-VL-72B-Instruct`, served via Nebius AI Studio) along with
   the notes accumulated so far and the last few seconds of live lecture
   transcript (captured via the Web Speech API in-browser). The model
   returns whether anything meaningfully changed, a spoken-style narration
   of it, and updated cumulative structured notes in Markdown.
5. **Present.** Each new narration is spoken aloud immediately
   (`SpeechSynthesis`), and the phone buzzes so a new update is noticeable
   even while Trace is mid-sentence on the last one.
6. **Remember.** Ending a class saves the full session (folder, title,
   every board state, image, narration, and transcript) and it shows up
   under its folder on the home page. Opening a past class gives a
   hands-free **Play this class** read-through — chained narration,
   previous/next, keyboard and voice control — plus the accumulated notes
   as a structured mind map.

## Voice control

Trace listens in two different ways, because during a class the microphone
is already committed to transcribing the lecture, and browsers only support
one active `SpeechRecognition` at a time.

**During a class**, commands are picked out of the live transcript and
require the wake word, so a teacher saying "let's pause here" doesn't pause
the app:

| Say | Effect |
| --- | --- |
| "Trace, pause" / "Trace, be quiet" | Stop narrating |
| "Trace, resume" / "Trace, keep going" | Start narrating again |
| "Trace, repeat" / "Trace, say that again" | Re-read the last update |
| "Trace, where am I" | Say what's going on and what was last on the board |
| "Trace, end class" | Save the class and go home |
| "Trace, help" (or just "Trace") | List every command |

Keyboard equivalents: **Space** pause/resume, **R** repeat, **H** help.

**Everywhere else** it's push-to-talk — press **V** anywhere, or the button
in the bottom corner — and no wake word is needed, since the whole
utterance is already addressed to Trace: "new class", "my classes",
"settings", "play", "next", "previous", "what can I say".

Because a voice interface is invisible, **"help" works on every screen**
and reads back exactly what that screen accepts.

## Other accessibility work

- **Adjustable reading speed** (0.75× to 3×) in settings. Experienced
  screen-reader users listen far faster than the default, and being stuck
  at one speed makes an app unusable for them.
- **Spoken guidance** — every screen announces what it is and what you can
  do on arrival. Switchable off for people who run their own screen reader
  and don't want two voices at once.
- **Haptics** — a buzz when the board changes, two for an erase, so updates
  land even when Trace is still speaking or the room is loud.
- **Real semantics, not just narration.** Trace's own speech is additive;
  the pages underneath use real headings, landmarks, labelled form
  controls, `aria-live` regions and a skip link, so VoiceOver, TalkBack and
  NVDA work normally on it.

## Accounts

Optional, and deliberately small: a name and a 4–8 digit **PIN**. No email,
no password, no recovery flow — a student on a shared school device signs
in by remembering four digits.

Without an account Trace is fully functional and every class stays in the
browser on that device. Signing in adds cross-device sync on top; it
doesn't unlock anything. Signing out clears the local copy, so a shared
laptop doesn't keep your work.

Safety measures on that PIN, since a 4-digit secret is a small one:

- PINs are never stored — only a per-account salted **PBKDF2-SHA256** hash
  (210,000 iterations).
- **Five wrong attempts locks the account for 15 minutes**, so the small
  keyspace can't just be walked.
- Sign-in takes the same time and returns the same message whether or not
  the account exists, so the endpoint can't be used to find out who has one.
- PIN comparison is constant-time; session cookies are `httpOnly`,
  `sameSite=lax`, HMAC-signed and `secure` in production.
- Obvious PINs (`0000`, `1234`) are rejected at creation.

Settings has a plain-language **"Where your data goes"** panel stating all
of this in the app itself, not just here.

## Stack

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript
- **Tailwind CSS v4** for styling — no component library
- **Vision model:** `Qwen/Qwen2.5-VL-72B-Instruct` via [Nebius AI
  Studio](https://studio.nebius.com/) (OpenAI-compatible API)
- **Web Speech API** (`SpeechRecognition` for live transcript and voice
  commands, `SpeechSynthesis` for narration) — browser-native, no external
  speech service
- `localStorage` for local class history; **Upstash Redis** over its REST
  API for optional account sync (no client library, no schema)

## What's fully built vs. mocked

Everything described above is fully implemented and functional — there is
no mocked or stubbed feature. Specific things worth knowing:

- The vision model call is a real API call on every analyzed frame; nothing
  is precomputed or canned.
- Voice commands are real speech recognition, not a scripted demo.
- Live transcription and voice commands depend on the browser's
  `SpeechRecognition` support (Chrome-based browsers). The app detects and
  reports when it's unavailable rather than failing silently.
- If the Upstash environment variables are absent, accounts fall back to an
  in-process store so the flow still runs locally. That fallback is not
  durable and is not meant for deployment — see below.
- The change-detection heuristic (pixel diff + a 30s forced re-check) is a
  deliberate cost/latency tradeoff, not a limitation we ran out of time to
  fix — it keeps the app from calling the vision model on every frame.

## Running it locally

```bash
npm install
```

Create `.env.local` in the project root:

```
NEBIUS_API_KEY=your_key_here
```

Get a key at [studio.nebius.com](https://studio.nebius.com/). Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Camera and microphone
permissions are required during a class; browsing saved classes works
without them.

Accounts work locally with no extra setup (in-memory store). To make them
durable and actually sync across devices, add a free
[Upstash Redis](https://upstash.com/) database and set:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
TRACE_SESSION_SECRET=any_long_random_string
```

## Deploying

Any Next.js host works (Vercel is the easiest fit). Set `NEBIUS_API_KEY`,
the two `UPSTASH_*` variables and `TRACE_SESSION_SECRET` in that host's
dashboard — they're read server-side only and never exposed to the browser.
On Vercel: `vercel login`, then `vercel --prod` from the project root, then
add the variables under Project Settings → Environment Variables and
redeploy.

## Required disclosures

**AI tools used to build this project:**

- [Claude Code](https://claude.com/claude-code) (Anthropic) — used
  throughout for implementation, debugging, and the accessibility-focused
  UI pass.

**AI models called at runtime by the app itself:**

- `Qwen/Qwen2.5-VL-72B-Instruct` (Alibaba Cloud / Qwen team), served
  serverless via [Nebius AI Studio](https://studio.nebius.com/) — reads
  each camera frame and produces narration + structured notes.

**Datasets:** None. Trace does not use any pretrained fine-tuning dataset,
scraped corpus, or synthetic dataset — all content it processes is the
user's own live camera and microphone input, generated during use.
