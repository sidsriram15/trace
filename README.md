# Trace

Real-time classroom access for blind and low-vision students. Point a phone
or laptop camera at a whiteboard before class starts, and Trace watches it,
listens to the lecture, and gives the class back in a form that actually
works for the student — spoken narration for a blind student, or large,
structured, high-contrast notes for a low-vision student. Every board state
is kept, including what gets erased, so nothing is lost the moment a
teacher wipes the board.

Built for the [Suvidha AI Virtual Hackathon 2026](https://suvidha-hackathon.vercel.app).

## The barrier this removes

A blind or low-vision student in a normal classroom has no reliable way to
follow what's written on a whiteboard. Screen readers don't see whiteboards.
A note-taker or aide isn't always available, and even when one is, erased
board content and the connection between "what's spoken" and "what's
written" are usually lost. Trace turns a phone camera into that missing
channel, live, without anyone else in the room needing to do anything
differently.

## How it works

1. **Set your mode, once.** Accessibility mode (Low Vision or Blind) is a
   **Settings** preference, not something re-picked every session — a
   student sets it once and every class after that follows it.
2. **Home is your classes.** The home page organizes past classes into
   folders (by subject, or however you like) plus an "Unsorted" bucket for
   anything not filed away. It's a browser, not a mode picker.
3. **Starting a class** goes through a dedicated, clear intro screen
   (`/new`) before any camera turns on — pick or create a folder, optionally
   name the class, and confirm you're ready. In Blind mode this screen also
   speaks its instructions aloud on load, so it doesn't depend on being
   read visually.
4. **Capture.** Once a class begins, the browser grabs a camera frame every
   few seconds and does a cheap client-side pixel-diff against the last
   frame it analyzed, so it only calls the model when the board actually
   looks different (or every 30s regardless, in case slow handwriting never
   trips the diff).
5. **Understand.** Changed frames go to a vision-language model
   (`Qwen/Qwen2.5-VL-72B-Instruct`, served via Nebius AI Studio) along with
   the notes accumulated so far and the last few seconds of live lecture
   transcript (captured via the Web Speech API in-browser). The model
   returns whether anything meaningfully changed, a spoken-style narration
   of it, and updated cumulative structured notes in Markdown.
6. **Present.**
   - **Blind mode** speaks each new narration aloud immediately
     (`SpeechSynthesis`), with pause/repeat controls and keyboard shortcuts
     (Space to pause, R to repeat).
   - **Low-vision mode** shows the live camera feed plus the notes rendered
     as a large-text mind map (branching topic → point structure, not a
     flat wall of text) and the live transcript, both continuously updated.
   - Ending a class saves the full session (folder, title, every board
     state, image, narration, and transcript) to `localStorage`, and it
     shows up under its folder on the home page. Opening a past class
     replays it — a mind-map notes view for low-vision sessions, and a full
     hands-free "Play this class" read-through (chained narration,
     previous/next, keyboard controls) for blind sessions.

## Stack

- **Next.js 16** (App Router, Turbopack), React 19, TypeScript
- **Tailwind CSS v4** for styling — no component library
- **Vision model:** `Qwen/Qwen2.5-VL-72B-Instruct` via [Nebius AI
  Studio](https://studio.nebius.com/) (OpenAI-compatible API)
- **Web Speech API** (`SpeechRecognition` for live transcript,
  `SpeechSynthesis` for narration) — browser-native, no external speech
  service
- `localStorage` for session history — no backend database

## What's fully built vs. mocked

Everything described above is fully implemented and functional — there is
no mocked or stubbed feature. Specific things worth knowing:

- The vision model call is a real API call on every analyzed frame; nothing
  is precomputed or canned.
- Session history is real but device-local (`localStorage`), not synced to
  an account or server. Clearing browser storage clears history.
- Live transcription depends on the browser's `SpeechRecognition` support
  (Chrome-based browsers). The app detects and reports when it's
  unavailable rather than failing silently.
- The change-detection heuristic (pixel diff + a 30s forced re-check) is a
  deliberate cost/latency tradeoff, not a limitation we ran out of time to
  fix — it keeps the app from calling the vision model on every single
  frame.

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
permissions are required for blind/low-vision mode; history works without
them.

## Deploying

Any Next.js host works (Vercel is the easiest fit). Whichever you use, set
`NEBIUS_API_KEY` as an environment variable in that host's dashboard — the
app reads it server-side in `src/app/api/describe/route.ts`, it's never
exposed to the browser. On Vercel: `vercel login`, then `vercel --prod`
from the project root, then add `NEBIUS_API_KEY` under Project Settings →
Environment Variables and redeploy.

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
