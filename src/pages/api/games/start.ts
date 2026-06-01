import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { setGameFlash } from "@/lib/game-flash";

export const prerender = false;

const startGameSchema = z.object({
  teamId: z.uuid("Choose a valid team before starting a game."),
  gameSlug: z.string().trim().min(1, "Choose a valid game before starting."),
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
  const parsed = startGameSchema.safeParse({
    teamId: form.get("teamId"),
    gameSlug: form.get("gameSlug"),
  });

  const fallbackTeamId = readStringField(form, "teamId");
  const fallbackGameSlug = readStringField(form, "gameSlug");
  const fallbackPath = fallbackTeamId && fallbackGameSlug ? gamePath(fallbackTeamId, fallbackGameSlug) : "/dashboard";

  if (!parsed.success) {
    setGameFlash(context.cookies, {
      type: "game-start-error",
      teamId: fallbackTeamId,
      gameSlug: fallbackGameSlug,
      message: parsed.error.issues[0]?.message ?? "Choose a valid game before starting.",
    });
    return context.redirect(fallbackPath);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    await services.startTeamGameRound({
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
    });

    setGameFlash(context.cookies, {
      type: "game-started",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      message: "The game is open. Teammates can submit their anonymous responses now.",
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't start this game right now.";

    setGameFlash(context.cookies, {
      type: "game-start-error",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      message,
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  }
};
