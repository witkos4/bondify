import * as React from "react";
import { getEmojiCheckInOption } from "@/lib/emoji-check-in";
import type { EmojiCheckInAggregatedEmojiCount } from "@/types";

interface EmojiCheckInRevealProps {
  emojiCounts: EmojiCheckInAggregatedEmojiCount[];
  submittedCount: number;
  triggerBurst?: boolean;
}

const BURST_VECTORS = [
  { x: "-6rem", y: "-3.5rem", rotate: "-16deg" },
  { x: "6rem", y: "-4rem", rotate: "14deg" },
  { x: "-7rem", y: "1.5rem", rotate: "10deg" },
  { x: "7rem", y: "2rem", rotate: "-12deg" },
  { x: "-1.5rem", y: "-6rem", rotate: "8deg" },
  { x: "2rem", y: "-6rem", rotate: "-10deg" },
];

export default function EmojiCheckInReveal({
  emojiCounts,
  submittedCount,
  triggerBurst = false,
}: EmojiCheckInRevealProps) {
  const burstEmojis: string[] = [];

  for (const count of emojiCounts) {
    burstEmojis.push(count.emoji);

    if (burstEmojis.length >= BURST_VECTORS.length) {
      break;
    }
  }

  while (burstEmojis.length < BURST_VECTORS.length) {
    burstEmojis.push(emojiCounts[burstEmojis.length % Math.max(emojiCounts.length, 1)]?.emoji ?? "✨");
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-emerald-300/10 p-6">
      <style>{`
        @keyframes emoji-check-in-burst {
          0% {
            transform: translate(-50%, -50%) scale(0.35);
            opacity: 0;
          }

          18% {
            opacity: 1;
          }

          100% {
            transform:
              translate(
                calc(-50% + var(--emoji-burst-x)),
                calc(-50% + var(--emoji-burst-y))
              )
              rotate(var(--emoji-burst-rotate))
              scale(1);
            opacity: 0;
          }
        }
      `}</style>

      {triggerBurst && (
        <div className="pointer-events-none absolute inset-0">
          {burstEmojis.map((emoji, index) => (
            <span
              key={`${emoji}-${index}`}
              className="emoji-glyph absolute top-1/2 left-1/2 [animation:emoji-check-in-burst_1100ms_ease-out_forwards] text-4xl"
              style={
                {
                  "--emoji-burst-x": BURST_VECTORS[index].x,
                  "--emoji-burst-y": BURST_VECTORS[index].y,
                  "--emoji-burst-rotate": BURST_VECTORS[index].rotate,
                  animationDelay: `${index * 55}ms`,
                } as React.CSSProperties
              }
            >
              {emoji}
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-emerald-50/80 uppercase">Team mood revealed</p>
            <h3 className="mt-2 text-3xl font-semibold text-white">Today&apos;s signal is in the open</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">
              {submittedCount} teammate{submittedCount === 1 ? "" : "s"} checked in. The view stays anonymous and
              focuses on the shared emotional pattern.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {emojiCounts.map((entry) => {
            const option = getEmojiCheckInOption(entry.emoji);

            return (
              <article key={entry.emoji} className="rounded-3xl border border-white/10 bg-slate-950/25 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="emoji-glyph text-3xl leading-none">{entry.emoji}</p>
                    <p className="mt-3 text-base font-semibold text-white">{option?.label ?? "Shared signal"}</p>
                  </div>
                  <span className="rounded-full border border-emerald-200/30 bg-emerald-100/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-emerald-50 uppercase">
                    {entry.count} vote{entry.count === 1 ? "" : "s"}
                  </span>
                </div>
                {option?.description && (
                  <p className="mt-3 text-sm leading-6 text-emerald-50/75">{option.description}</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
