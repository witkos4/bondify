import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { setGameFlash } from "@/lib/game-flash";

export const prerender = false;

const closeVotingSchema = z.object({
  teamId: z.uuid("Choose a valid team before closing voting."),
  gameSlug: z.string().trim().min(1, "Choose a valid game before closing voting."),
  roundId: z.uuid("Choose an active structured round before closing voting."),
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
  const parsed = closeVotingSchema.safeParse({
    teamId: form.get("teamId"),
    gameSlug: form.get("gameSlug"),
    roundId: form.get("roundId"),
  });

  const fallbackTeamId = readStringField(form, "teamId");
  const fallbackGameSlug = readStringField(form, "gameSlug");
  const fallbackPath = fallbackTeamId && fallbackGameSlug ? gamePath(fallbackTeamId, fallbackGameSlug) : "/dashboard";

  if (!parsed.success) {
    setGameFlash(context.cookies, {
      type: "two-truths-vote-error",
      teamId: fallbackTeamId,
      gameSlug: fallbackGameSlug,
      message: parsed.error.issues[0]?.message ?? "Choose a valid structured round before closing voting.",
    });
    return context.redirect(fallbackPath);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    await services.closeTwoTruthsVoting({
      roundId: parsed.data.roundId,
    });

    setGameFlash(context.cookies, {
      type: "two-truths-voting-closed",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      message: "Voting is closed. Reveal is ready.",
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  } catch (error) {
    const message =
      error instanceof BondifyServiceError ? error.message : "We couldn't close voting for this structured round.";

    setGameFlash(context.cookies, {
      type: "two-truths-vote-error",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      message,
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  }
};
