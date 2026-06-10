import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { setGameFlash } from "@/lib/game-flash";

export const prerender = false;

const submitTwoTruthsEntrySchema = z.object({
  teamId: z.uuid("Choose a valid team before submitting."),
  gameSlug: z.string().trim().min(1, "Choose a valid game before submitting."),
  roundId: z.uuid("Choose an active game before submitting."),
  statementOne: z.string().trim().min(1, "Statement 1 cannot be blank.").max(200, "Statement 1 is too long."),
  statementTwo: z.string().trim().min(1, "Statement 2 cannot be blank.").max(200, "Statement 2 is too long."),
  statementThree: z.string().trim().min(1, "Statement 3 cannot be blank.").max(200, "Statement 3 is too long."),
  lieStatementIndex: z.coerce.number().int("Choose which statement is the lie."),
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
  const parsed = submitTwoTruthsEntrySchema.safeParse({
    teamId: form.get("teamId"),
    gameSlug: form.get("gameSlug"),
    roundId: form.get("roundId"),
    statementOne: form.get("statementOne"),
    statementTwo: form.get("statementTwo"),
    statementThree: form.get("statementThree"),
    lieStatementIndex: form.get("lieStatementIndex"),
  });

  const fallbackTeamId = readStringField(form, "teamId");
  const fallbackGameSlug = readStringField(form, "gameSlug");
  const fallbackPath = fallbackTeamId && fallbackGameSlug ? gamePath(fallbackTeamId, fallbackGameSlug) : "/dashboard";
  const fallbackStatementOne = readStringField(form, "statementOne");
  const fallbackStatementTwo = readStringField(form, "statementTwo");
  const fallbackStatementThree = readStringField(form, "statementThree");
  const fallbackLieStatementIndex = readStringField(form, "lieStatementIndex");

  if (!parsed.success) {
    setGameFlash(context.cookies, {
      type: "two-truths-entry-error",
      teamId: fallbackTeamId,
      gameSlug: fallbackGameSlug,
      statementOne: fallbackStatementOne,
      statementTwo: fallbackStatementTwo,
      statementThree: fallbackStatementThree,
      lieStatementIndex: fallbackLieStatementIndex,
      message: parsed.error.issues[0]?.message ?? "All three statements are required.",
    });
    return context.redirect(fallbackPath);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    await services.submitTwoTruthsEntry({
      roundId: parsed.data.roundId,
      statementOne: parsed.data.statementOne,
      statementTwo: parsed.data.statementTwo,
      statementThree: parsed.data.statementThree,
      lieStatementIndex: parsed.data.lieStatementIndex,
    });

    setGameFlash(context.cookies, {
      type: "two-truths-entry-submitted",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      message: "Your structured set is saved. You are locked in for this round.",
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  } catch (error) {
    const message =
      error instanceof BondifyServiceError ? error.message : "We couldn't save your structured set right now.";

    setGameFlash(context.cookies, {
      type: "two-truths-entry-error",
      teamId: parsed.data.teamId,
      gameSlug: parsed.data.gameSlug,
      statementOne: parsed.data.statementOne,
      statementTwo: parsed.data.statementTwo,
      statementThree: parsed.data.statementThree,
      lieStatementIndex: String(parsed.data.lieStatementIndex),
      message,
    });
    return context.redirect(gamePath(parsed.data.teamId, parsed.data.gameSlug));
  }
};
