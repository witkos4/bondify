import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { setGameFlash } from "@/lib/game-flash";

export const prerender = false;

const voteSchema = z.object({
  teamId: z.uuid("Choose a valid team before submitting a guess."),
  gameSlug: z.string().trim().min(1, "Choose a valid game before submitting a guess."),
  roundId: z.uuid("Choose an active structured round before submitting a guess."),
  targetEntryId: z.uuid("Choose a valid teammate entry before submitting a guess."),
  guessedLieIndex: z.coerce.number().int("Choose which statement you think is the lie."),
});

function readStringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function gamePath(teamId: string, gameSlug: string): string {
  return `/teams/${encodeURIComponent(teamId)}/games/${encodeURIComponent(gameSlug)}`;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = voteSchema.safeParse({
    teamId: form.get("teamId"),
    gameSlug: form.get("gameSlug"),
    roundId: form.get("roundId"),
    targetEntryId: form.get("targetEntryId"),
    guessedLieIndex: form.get("guessedLieIndex"),
  });

  const fallbackTeamId = readStringField(form, "teamId");
  const fallbackGameSlug = readStringField(form, "gameSlug");
  const fallbackPath = fallbackTeamId && fallbackGameSlug ? gamePath(fallbackTeamId, fallbackGameSlug) : "/dashboard";

  if (!parsed.success) {
    setGameFlash(context.cookies, {
      type: "two-truths-vote-error",
      teamId: fallbackTeamId,
      gameSlug: fallbackGameSlug,
      message: parsed.error.issues[0]?.message ?? "Choose a valid teammate entry before submitting a guess.",
    });
    return context.redirect(fallbackPath);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    await services.submitTwoTruthsGuess({
      roundId: parsed.data.roundId,
      targetEntryId: parsed.data.targetEntryId,
      guessedLieIndex: parsed.data.guessedLieIndex,
    });

    setGameFlash(context.cookies, {
      type: "two-truths-vote-submitted",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      message: "Your guess is saved.",
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't save your guess right now.";

    setGameFlash(context.cookies, {
      type: "two-truths-vote-error",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      message,
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  }
};
