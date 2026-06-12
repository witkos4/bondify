import * as React from "react";
import type { EmojiCheckInOption } from "@/lib/emoji-check-in";

interface EmojiCheckInPickerProps {
  teamId: string;
  sessionId: string;
  action: string;
  options: EmojiCheckInOption[];
  initialSelected?: string[];
}

const MAX_SELECTIONS = 3;

export default function EmojiCheckInPicker({
  teamId,
  sessionId,
  action,
  options,
  initialSelected = [],
}: EmojiCheckInPickerProps) {
  const [selectedEmojis, setSelectedEmojis] = React.useState<string[]>(initialSelected.slice(0, MAX_SELECTIONS));

  function toggleEmoji(emoji: string) {
    setSelectedEmojis((currentSelection) => {
      if (currentSelection.includes(emoji)) {
        return currentSelection.filter((value) => value !== emoji);
      }

      if (currentSelection.length >= MAX_SELECTIONS) {
        return currentSelection;
      }

      return [...currentSelection, emoji];
    });
  }

  return (
    <form method="POST" action={action} className="space-y-5">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      {selectedEmojis.map((emoji) => (
        <input key={emoji} type="hidden" name="emojis" value={emoji} />
      ))}

      <div className="flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-slate-950/25 px-4 py-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-cyan-100/60 uppercase">Your picks</p>
          <p className="mt-2 text-sm text-blue-100/70">Choose one to three emojis that match the team&apos;s day.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white">
          {selectedEmojis.length}/3
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {options.map((option) => {
          const isSelected = selectedEmojis.includes(option.emoji);
          const isLocked = !isSelected && selectedEmojis.length >= MAX_SELECTIONS;

          return (
            <button
              key={option.emoji}
              type="button"
              onClick={() => {
                toggleEmoji(option.emoji);
              }}
              aria-pressed={isSelected}
              className={[
                "rounded-3xl border p-4 text-left transition",
                isSelected
                  ? "border-amber-200/45 bg-amber-200/12 shadow-lg shadow-amber-500/10"
                  : "border-white/10 bg-white/6 hover:border-cyan-200/35 hover:bg-cyan-200/8",
                isLocked ? "opacity-55" : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-3xl">{option.emoji}</p>
                  <p className="mt-3 text-base font-semibold text-white">{option.label}</p>
                </div>
                <span
                  className={[
                    "mt-1 inline-flex size-6 items-center justify-center rounded-full border text-xs font-semibold",
                    isSelected
                      ? "border-amber-200/45 bg-amber-100/15 text-amber-100"
                      : "border-white/10 bg-slate-950/35 text-blue-100/45",
                  ].join(" ")}
                >
                  {isSelected ? "✓" : "+"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/6 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            {selectedEmojis.length === 0
              ? "Pick at least one emoji to join today&apos;s mood check."
              : `Ready to submit ${selectedEmojis.length} emoji${selectedEmojis.length === 1 ? "" : "s"}.`}
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-100/55">
            After you submit, today&apos;s check-in is locked for your account.
          </p>
        </div>
        <button
          type="submit"
          disabled={selectedEmojis.length === 0}
          className="rounded-2xl bg-cyan-400/90 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
        >
          Save today&apos;s emojis
        </button>
      </div>
    </form>
  );
}
