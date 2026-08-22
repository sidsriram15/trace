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
  | "folder"
  | "pin"
  | "submit"
  | "account"
  | "speed"
  | "toggle"
  | "open";

/**
 * A recognized command. `value` carries free text the student dictated, or
 * for "speed"/"toggle" one of a fixed set of keys ("faster"/"slower"/
 * "normal", "haptics-on"/"haptics-off"/"guidance-on"/"guidance-off").
 */
export type VoiceCommand = { action: VoiceAction; value?: string };

/**
 * What each action means, for the LLM fallback (see /api/intent) to pick
 * from when a phrase doesn't match anything in the fixed vocabulary below.
 * Kept next to the vocabulary itself so the two never drift apart.
 */
export const ACTION_DESCRIPTIONS: Record<VoiceAction, string> = {
  pause: "pause the class — stop reading aloud and stop watching the board",
  resume: "resume a paused class",
  repeat: "repeat the last thing that was read aloud",
  help: "list everything that can be said on this screen",
  end: "end the class and save it",
  home: "go to the list of saved classes",
  new: "start a new class — or, if already on the new-class screen, begin it",
  settings: "open settings",
  play: "play or read back the current saved class from the start",
  next: "move to the next board update in a saved class",
  previous: "move to the previous board update in a saved class",
  status: "say what screen this is and what's currently happening",
  name: "name or rename the class (or, on the account screen, the student's name) — value is the dictated name",
  folder: "file the class into a folder, or create a standalone folder — value is the folder name",
  pin: "set the account PIN — value is the spoken digits with no spaces, e.g. \"1234\"",
  submit: "create an account or sign into one — value is \"create\" or \"signin\"",
  account: "go to the account / sign-in screen",
  speed: "change the reading speed — value is \"faster\", \"slower\", or \"normal\"",
  toggle: "turn a setting on or off — value is \"haptics-on\", \"haptics-off\", \"guidance-on\", or \"guidance-off\"",
  open: "open a saved class by name and start reading it — value is the class name, or \"__last__\" for the most recently saved one",
};

// Everything after one of these is treated as the class name (or, on the
// account page, the student's name) rather than matched against the fixed
// vocabulary. Longest first so "call this class" wins over "call this".
const NAMING_PREFIXES = [
  "name this class",
  "name the class",
  "call this class",
  "call the class",
  "name this lesson",
  "call this lesson",
  "my name is",
  "the name is",
  "name this",
  "call this",
  "call me",
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
  "make a folder called",
  "make a folder",
  "make a new folder called",
  "make a new folder",
  "create a folder called",
  "create a folder",
  "create a new folder called",
  "create a new folder",
  "start a folder called",
  "new folder called",
  "new folder",
  "add a folder called",
  "add a folder",
  "put the class in the",
  "put the class in",
  "put this class in the",
  "put this class in",
  "put this in the",
  "put this in",
  "put it in the",
  "put it in",
  "file the class under",
  "file the class in",
  "file this class under",
  "file this under",
  "file it under",
  "file under",
  "move the class to",
  "move this class to",
  "move it to",
  "move this to",
  "add the class to",
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

// Dictating a PIN: everything after one of these is digits, spoken either
// as words ("one two three four") or as numerals if the recognizer already
// converted them. Longest first so "set my pin to" wins over "pin".
const PIN_PREFIXES = [
  "set my pin to",
  "set the pin to",
  "make my pin",
  "my pin is",
  "the pin is",
  "pin number",
  "pin is",
  "pin",
];

const DIGIT_WORDS: Record<string, string> = {
  zero: "0",
  oh: "0",
  o: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
};

/** "one two three four" or "1234" (however the recognizer heard it) → "1234". */
function wordsToDigits(text: string): string {
  let out = "";
  for (const token of text.split(" ")) {
    if (/^\d+$/.test(token)) {
      out += token;
      continue;
    }
    const digit = DIGIT_WORDS[token];
    if (digit) out += digit;
  }
  return out.slice(0, 8);
}

// Setting up or signing into an account. Matched before the generic
// vocabulary so "sign in" doesn't need to be spelled out phonetically.
const ACCOUNT_PHRASES: [string, string[]][] = [
  ["create", ["create an account", "create account", "create my account", "make an account", "set up an account", "sign up"]],
  ["signin", ["sign in", "log in", "sign me in", "log me in"]],
];

// Reading speed, by voice — relative rather than a spoken number, since
// "one point five" is much easier to mishear than "faster".
const SPEED_PHRASES: [string, string[]][] = [
  ["faster", ["read faster", "speak faster", "go faster", "speed up", "faster"]],
  ["slower", ["read slower", "speak slower", "go slower", "slow down", "slower"]],
  ["normal", ["normal speed", "reset the speed", "reset speed", "default speed"]],
];

// On/off settings, by voice.
const TOGGLE_PHRASES: [string, string[]][] = [
  ["haptics-on", ["turn on vibration", "turn vibration on", "enable vibration", "vibration on"]],
  ["haptics-off", ["turn off vibration", "turn vibration off", "disable vibration", "vibration off"]],
  [
    "guidance-on",
    [
      "turn on spoken guidance",
      "turn spoken guidance on",
      "enable spoken guidance",
      "spoken guidance on",
    ],
  ],
  [
    "guidance-off",
    [
      "turn off spoken guidance",
      "turn spoken guidance off",
      "disable spoken guidance",
      "spoken guidance off",
    ],
  ],
];

// Jumping straight into a saved class from the list, by name or "the last
// class". Checked last, after the fixed vocabulary, so a bare "open" or
// "read" doesn't swallow "open settings" or "read that again" — those are
// specific commands and should win over this catch-all.
const LAST_CLASS_PHRASES = [
  "my last class",
  "the last class",
  "most recent class",
  "latest class",
  "last class",
];

const OPEN_PREFIXES = [
  "open the class called",
  "open my class called",
  "open class called",
  "play the class called",
  "play my class called",
  "read the class called",
  "read my class called",
  "go to the class called",
  "go to my class called",
  "go into the class called",
  "go into my class called",
  "open the class",
  "open my class",
  "open",
  "play",
  "read",
];

const OPEN_LEAD = /^(the\s+)?(class\s+)?(called\s+|named\s+)?/;
const OPEN_SUFFIX = /\s+(class|lesson)$/;

// Longest phrases first within each action so "start over" doesn't get
// swallowed by "start". Order across actions matters too: the first action
// whose phrase is found wins, so put specific ones above generic ones.
const VOCABULARY: [VoiceAction, string[]][] = [
  ["help", ["what can i say", "what can you do", "help me", "commands", "help"]],
  ["end", ["end the class", "end class", "stop the class", "finish class", "end this", "end"]],
  ["repeat", ["say that again", "read that again", "repeat that", "again", "repeat", "what did you say"]],
  ["resume", ["start talking", "keep going", "resume", "unpause", "continue"]],
  ["pause", ["be quiet", "stop talking", "pause", "quiet", "shush", "hush", "mute"]],
  ["new", ["start a new class", "new class", "start class", "begin class", "new lesson"]],
  ["settings", ["open settings", "settings", "preferences"]],
  [
    "account",
    [
      "let's make an account",
      "lets make an account",
      "make an account",
      "set up an account",
      "create an account",
      "create account",
      "sign up",
      "sign in",
      "log in",
      "add a pin",
      "my account",
      "account",
    ],
  ],
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

  if (!allowed || allowed.includes("pin")) {
    for (const prefix of PIN_PREFIXES) {
      const at = said.indexOf(prefix);
      if (at === -1) continue;
      const digits = wordsToDigits(said.slice(at + prefix.length).trim());
      if (digits) return { action: "pin", value: digits };
    }
  }

  if (!allowed || allowed.includes("submit")) {
    for (const [value, phrases] of ACCOUNT_PHRASES) {
      if (phrases.some((p) => said.includes(p))) return { action: "submit", value };
    }
  }

  if (!allowed || allowed.includes("speed")) {
    for (const [value, phrases] of SPEED_PHRASES) {
      if (phrases.some((p) => said.includes(p))) return { action: "speed", value };
    }
  }

  if (!allowed || allowed.includes("toggle")) {
    for (const [value, phrases] of TOGGLE_PHRASES) {
      if (phrases.some((p) => said.includes(p))) return { action: "toggle", value };
    }
  }

  for (const [action, phrases] of VOCABULARY) {
    if (allowed && !allowed.includes(action)) continue;
    if (phrases.some((p) => said.includes(p))) return { action };
  }

  // Last resort, checked after every fixed command: jump straight into a
  // saved class by name. Below the fixed vocabulary so a bare "open" or
  // "read" never shadows "open settings" or "read that again".
  if (!allowed || allowed.includes("open")) {
    if (LAST_CLASS_PHRASES.some((p) => said.includes(p))) {
      return { action: "open", value: "__last__" };
    }
    for (const prefix of OPEN_PREFIXES) {
      const at = said.indexOf(prefix);
      if (at === -1) continue;
      const value = said
        .slice(at + prefix.length)
        .trim()
        .replace(OPEN_LEAD, "")
        .replace(OPEN_SUFFIX, "")
        .trim();
      if (value) return { action: "open", value };
    }
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
