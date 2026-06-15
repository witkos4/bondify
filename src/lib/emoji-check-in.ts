import type { EmojiCheckInAggregatedEmojiCount } from "@/types";

export interface EmojiCheckInOption {
  emoji: string;
  label: string;
  description: string;
}

export const EMOJI_CHECK_IN_TEMPLATE_SLUG = "emoji-check-in";
export const EMOJI_CHECK_IN_DEFAULT_TIME_ZONE = "UTC";
export const MIN_EMOJI_CHECK_IN_EMOJIS = 1;
export const MAX_EMOJI_CHECK_IN_EMOJIS = 3;

export const EMOJI_CHECK_IN_OPTIONS: EmojiCheckInOption[] = [
  { emoji: "😄", label: "Upbeat", description: "Energy is high and things feel bright." },
  { emoji: "🙂", label: "Steady", description: "Today feels calm, stable, and solid." },
  { emoji: "🤝", label: "Connected", description: "The team feels collaborative and close." },
  { emoji: "🧠", label: "Focused", description: "Heads are down and concentration is strong." },
  { emoji: "🎯", label: "Locked in", description: "The team feels sharp and intentional." },
  { emoji: "🚀", label: "Momentum", description: "Progress feels fast and exciting." },
  { emoji: "🌱", label: "Hopeful", description: "Something good feels like it is growing." },
  { emoji: "😌", label: "Calm", description: "The pace is grounded and manageable." },
  { emoji: "🥳", label: "Celebrating", description: "The team is in a wins-and-gratitude mood." },
  { emoji: "😅", label: "Busy", description: "There is a lot happening, but we are moving." },
  { emoji: "🤔", label: "Curious", description: "Questions and reflection are leading the day." },
  { emoji: "😴", label: "Drained", description: "Energy feels low and recovery is needed." },
  { emoji: "😬", label: "Tense", description: "There is a little friction or pressure today." },
  { emoji: "🌧️", label: "Heavy", description: "The emotional weather feels weighty." },
  { emoji: "🔥", label: "Stretched", description: "The team is under heat or high load." },
  { emoji: "❤️", label: "Cared for", description: "Support and appreciation are showing up." },
  { emoji: "💡", label: "Inspired", description: "New ideas are sparking." },
  { emoji: "🫶", label: "Supported", description: "People feel backed up and seen." },
  { emoji: "🌊", label: "Flowing", description: "Work feels smooth and natural." },
  { emoji: "⚡", label: "Energized", description: "The pace feels lively and strong." },
  { emoji: "🧩", label: "Figuring it out", description: "Things are still coming together." },
  { emoji: "😵‍💫", label: "Swamped", description: "The day feels overloaded or chaotic." },
  { emoji: "🛟", label: "Need support", description: "Extra help would make a difference." },
  { emoji: "🎉", label: "Proud", description: "The team is feeling a real win." },
  { emoji: "🧘", label: "Centered", description: "The team feels present, balanced, and grounded." },
];

const EMOJI_CHECK_IN_OPTION_BY_EMOJI = new Map(EMOJI_CHECK_IN_OPTIONS.map((option) => [option.emoji, option]));
const VALID_EMOJI_CHECK_IN_EMOJIS = new Set(EMOJI_CHECK_IN_OPTIONS.map((option) => option.emoji));

export function getEmojiCheckInOption(emoji: string): EmojiCheckInOption | null {
  return EMOJI_CHECK_IN_OPTION_BY_EMOJI.get(emoji) ?? null;
}

export function getEmojiCheckInSessionDateKey(
  date: Date = new Date(),
  timeZone: string = EMOJI_CHECK_IN_DEFAULT_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to derive the Emoji Check-In session date key.");
  }

  return `${year}-${month}-${day}`;
}

export function isEmojiCheckInTemplateSlug(gameSlug: string): boolean {
  return gameSlug.trim() === EMOJI_CHECK_IN_TEMPLATE_SLUG;
}

export function normalizeEmojiCheckInSelection(emojis: string[]): string[] {
  const trimmedEmojis = emojis.map((emoji) => emoji.trim()).filter((emoji) => emoji.length > 0);

  if (trimmedEmojis.length < MIN_EMOJI_CHECK_IN_EMOJIS || trimmedEmojis.length > MAX_EMOJI_CHECK_IN_EMOJIS) {
    throw new Error(
      `Choose between ${MIN_EMOJI_CHECK_IN_EMOJIS} and ${MAX_EMOJI_CHECK_IN_EMOJIS} emojis for today's check-in.`,
    );
  }

  const uniqueEmojis: string[] = [];

  for (const emoji of trimmedEmojis) {
    if (!VALID_EMOJI_CHECK_IN_EMOJIS.has(emoji)) {
      throw new Error("Choose emojis from the Bondify picker only.");
    }

    if (uniqueEmojis.includes(emoji)) {
      throw new Error("Choose distinct emojis so your check-in stays readable.");
    }

    uniqueEmojis.push(emoji);
  }

  return uniqueEmojis;
}

export function summarizeEmojiCheckInSelections(emojis: string[]): EmojiCheckInAggregatedEmojiCount[] {
  const counts = new Map<string, number>();

  for (const emoji of emojis) {
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji));
}
