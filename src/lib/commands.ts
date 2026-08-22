/**
 * Voice command vocabulary.
 *
 * Two entry points, because Trace listens in two very different ways:
 *
 * - During a class the microphone is already held by the lecture
 *   recognizer, so commands have to be picked out of the transcript
 *   stream. That needs a wake word ("Trace, pause") — otherwise a teacher
 *   saying "let's pause here" would pause the app.
 * - Everywhere else the student presses to talk, so the whole utterance is
 *   already addressed to Trace and no wake word is required.
 */

export type VoiceAction =
  | "pause"
  | "resume"
  | "repeat"
  | "help"
  | "end"
  | "home"
  | "new"
  | "settings"
  | "play"
  | "next"
  | "previous"
  | "status"
  | "name"
  | "folder";

/**
 * A recognized command. `value` carries free text the student dictated —
 * only "name" uses it, but the shape is what lets a command be more than a
 * fixed phrase.
 */
export type VoiceCommand = { action: VoiceAction; value?: string };

// Everything after one of these is treated as the class name rather than
// matched against the fixed vocabulary. Longest first so "call this class"
// wins over "call this".
const NAMING_PREFIXES = [
  "name this class",
  "name the class",
  "call this class",
  "call the class",
  "name this lesson",
  "call this lesson",
  "the name is",
  "name this",
  "call this",
  "name it",
  "call it",
  "title it",
  "rename to",
  "rename it",
];

// Dictation habitually tacks these onto the front of the spoken name.
const NAME_FILLER = /^(is|as|to|it)\s+/;

// Same idea for filing a class into a folder: everything after the prefix
// is the folder name, matched against the folders that actually exist.
const FOLDER_PREFIXES = [
  "put this in the",
  "put this in",
  "put it in the",
  "put it in",
  "file this under",
  "file it under",
  "file under",
  "move it to",
  "move this to",
  "add it to",
  "add this to",
  "folder is",
  "the folder",
  "folder",
];

// Trailing words students add after the folder name, e.g. "put it in the
// science folder".
const FOLDER_SUFFIX = /\s+(folder|class|classes)$/;

// ...and the same at the front: "put it in the folder called science".
const FOLDER_LEAD = /^(the\s+)?(folder\s+)?(called\s+|named\s+)?/;

// Longest phrases first within each action so "start over" doesn't get
// swallowed by "start". Order across actions matters too: the first action
// whose phrase is found wins, so put specific ones above generic ones.
const VOCABULARY: [VoiceAction, string[]][] = [
  ["help", ["what can i say", "what can you do", "help me", "commands", "help"]],
  ["end", ["end the class", "end class", "stop the class", "finish class", "end this"]],
  ["repeat", ["say that again", "read that again", "repeat that", "again", "repeat", "what did you say"]],
  ["resume", ["start talking", "keep going", "resume", "unpause", "continue"]],
  ["pause", ["be quiet", "stop talking", "pause", "quiet", "shush", "hush", "mute"]],
  ["new", ["start a new class", "new class", "start class", "begin class", "new lesson"]],
  ["settings", ["open settings", "settings", "preferences"]],
  ["home", ["my classes", "your classes", "go home", "home", "back", "class list"]],
  ["play", ["play this class", "play the class", "read the class", "play", "listen"]],
  ["next", ["next update", "next one", "next", "forward", "skip"]],
  ["previous", ["previous update", "go back one", "previous", "back one", "last one"]],
  ["status", ["where am i", "what page", "what is this", "what's happening"]],
];

// "Trace" is short and gets misheard constantly. Accept the near misses —
// a wake word that only works when the recognizer is perfect is a wake
// word that doesn't work. Single tokens only; these are matched word by
// word against the normalized transcript.
const WAKE_WORDS = [
  "trace",
  "traces",
  "trace's",
  "trays",
  "tracy",
  "trice",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match an utterance already known to be addressed to Trace (push-to-talk).
 * `allowed` scopes matching to what the current screen can actually do, so
 * "next" on the home page doesn't silently match a playback command.
 */
export function matchCommand(
  text: string,
  allowed?: readonly VoiceAction[],
): VoiceCommand | null {
  const said = normalize(text);
  if (!said) return null;

  // Naming is checked first and takes the rest of the utterance verbatim.
  // Otherwise a class called "next steps" would match the "next" command.
  if (!allowed || allowed.includes("name")) {
    for (const prefix of NAMING_PREFIXES) {
      const at = said.indexOf(prefix);
      if (at === -1) continue;
      const value = said
        .slice(at + prefix.length)
        .trim()
        .replace(NAME_FILLER, "")
        .trim();
      if (value) return { action: "name", value };
    }
  }

  if (!allowed || allowed.includes("folder")) {
    for (const prefix of FOLDER_PREFIXES) {
      const at = said.indexOf(prefix);
      if (at === -1) continue;
      const value = said
        .slice(at + prefix.length)
        .trim()
        .replace(FOLDER_LEAD, "")
        .replace(FOLDER_SUFFIX, "")
        .trim();
      if (value) return { action: "folder", value };
    }
  }

  for (const [action, phrases] of VOCABULARY) {
    if (allowed && !allowed.includes(action)) continue;
    if (phrases.some((p) => said.includes(p))) return { action };
  }
  return null;
}

/**
 * Pull a command out of live lecture transcript. Returns null unless the
 * wake word is present — everything else is the teacher talking and belongs
 * in the transcript, not the command handler.
 *
 * The wake word is looked for anywhere in the chunk, not just at the start.
 * Continuous recognition splits speech at arbitrary points, so "Trace,
 * pause" routinely arrives as "so anyway trace pause" — requiring the chunk
 * to begin with the wake word meant commands mostly didn't fire.
 */
export function parseWakeCommand(
  text: string,
  allowed?: readonly VoiceAction[],
): VoiceCommand | null {
  const said = normalize(text);
  if (!said) return null;

  const words = said.split(" ");
  // Last occurrence wins: if the student restarts themselves mid-sentence,
  // what follows the final "Trace" is the command they meant.
  let at = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (WAKE_WORDS.includes(words[i])) {
      at = i;
      break;
    }
  }
  if (at === -1) return null;

  const rest = words.slice(at + 1).join(" ");
  // Bare "Trace" with nothing after it is treated as a request for help,
  // so a student who forgets the command list can always get it back.
  if (!rest) return { action: "help" };
  return matchCommand(rest, allowed);
}

/**
 * True if this chunk was aimed at Trace but didn't resolve to a command,
 * so it should be dropped rather than filed as lecture transcript. Capped
 * at a few words: a teacher saying "trace the graph from x to y" is
 * teaching, not issuing a command Trace failed to understand.
 */
export function isWakePhrase(text: string): boolean {
  const words = normalize(text).split(" ").filter(Boolean);
  if (!words.length || words.length > 4) return false;
  return words.some((w) => WAKE_WORDS.includes(w));
}
