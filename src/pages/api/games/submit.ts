import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { setGameFlash } from "@/lib/game-flash";

export const prerender = false;

const submitResponseSchema = z.object({
  teamId: z.uuid("Choose a valid team before submitting."),
  gameSlug: z.string().trim().min(1, "Choose a valid game before submitting."),
  roundId: z.uuid("Choose an active game before submitting."),
  responseText: z.string().trim().min(1, "Response text cannot be blank.").max(500, "Response text is too long."),
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
  const parsed = submitResponseSchema.safeParse({
    teamId: form.get("teamId"),
    gameSlug: form.get("gameSlug"),
    roundId: form.get("roundId"),
    responseText: form.get("responseText"),
  });

  const fallbackTeamId = readStringField(form, "teamId");
  const fallbackGameSlug = readStringField(form, "gameSlug");
  const fallbackResponseText = readStringField(form, "responseText");
  const fallbackPath = fallbackTeamId && fallbackGameSlug ? gamePath(fallbackTeamId, fallbackGameSlug) : "/dashboard";

  if (!parsed.success) {
    setGameFlash(context.cookies, {
      type: "response-submit-error",
      teamId: fallbackTeamId,
      gameSlug: fallbackGameSlug,
      responseText: fallbackResponseText,
      message: parsed.error.issues[0]?.message ?? "Response text cannot be blank.",
    });
    return context.redirect(fallbackPath);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    await services.submitCurrentMemberResponse({
      roundId: parsed.data.roundId,
      responseText: parsed.data.responseText,
    });

    setGameFlash(context.cookies, {
      type: "response-submitted",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      message: "Your anonymous response is saved. Results will unlock in the reveal step.",
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't save your response right now.";

    setGameFlash(context.cookies, {
      type: "response-submit-error",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      responseText: parsed.data.responseText,
      message,
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  }
};
