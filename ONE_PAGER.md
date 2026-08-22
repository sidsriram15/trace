# Trace

**Real-time classroom access for blind students — operated entirely by
voice.**

## Who this is for

A middle or high schooler who is blind, sitting in a normal classroom where
the teacher writes on a whiteboard. That student can hear the lecture, but
the whiteboard — equations, diagrams, worked examples, vocabulary lists —
is invisible to them the moment it's written, and gone entirely the moment
it's erased. No amount of good audio-only teaching fixes that; a huge
amount of what actually gets *taught* in a classroom lives on that board.

## The barrier

Whiteboards are a purely visual channel with no built-in accessible
equivalent. A human note-taker helps but isn't always available, isn't
always accurate, and still loses erased content and the live connection
between what's spoken and what's written. Existing tools (screen readers,
OCR scanners, generic photo-to-text apps) are built for static documents —
none of them watch a board *continuously*, catch changes as they happen, or
preserve history the way a sighted student's own eyes and memory would.

## What Trace does

A student points a phone or laptop camera at the board before class. Trace:

1. **Watches** the board continuously, catching changes as they happen —
   including catching and labeling when content gets erased, so nothing is
   silently lost.
2. **Understands** each change with a vision-language model, informed by the
   notes built up so far and the last few seconds of what the teacher is
   saying, so a scribbled formula gets read in context, not read off flat.
3. **Speaks it** immediately, hands-free, and buzzes the phone so a new
   update registers even while Trace is still mid-sentence on the last one.
4. **Takes orders by voice.** Mid-class, "Trace, pause", "Trace, repeat",
   "Trace, end class". Elsewhere, press V and just say "new class" or "play
   this class". And since a voice interface is invisible, **"help" works on
   every screen** and reads back exactly what that screen accepts.
5. **Remembers.** Every class is saved automatically, filed under a folder
   the student organizes by subject. Later they can press **Play this
   class** and hear the entire board history read back start to finish,
   hands-free — built specifically to support studying, not just live use.

## Why this approach

Most accessible-education tools assume a static document — a PDF, a slide
deck. A whiteboard is *live and disappearing*, and that's the part nobody
builds for. Trace's core idea is treating the whiteboard itself as a
continuous, appendable, replayable transcript — so a blind student doesn't
just get access to *the current* board state, they get access to the *whole
class*, the same way a sighted student's notes would capture it.

The second idea is that an accessibility tool has to be accessible on its
own terms. Trace is blind-first rather than blind-compatible: reading speed
goes to 3× because experienced screen-reader users listen that fast, every
screen announces itself on arrival, sign-in is a PIN because a blind student
on a shared school laptop shouldn't have to type an email and a password,
and there is no control anywhere that can only be reached by seeing it.

## Built with

Next.js, TypeScript, Tailwind CSS, the Web Speech API (browser-native
transcription, voice commands and narration), `Qwen/Qwen2.5-VL-72B-Instruct`
served via Nebius AI Studio for real-time board understanding, and Upstash
Redis for optional PIN-account sync. Built with the help of Claude Code.
Full technical and safety disclosures in [README.md](./README.md).

## Try it

Live demo: _[add deployed URL here]_
Source: _[add GitHub repo URL here]_
