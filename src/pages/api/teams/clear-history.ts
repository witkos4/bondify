import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { setHistoryFlash } from "@/lib/history-flash";

export const prerender = false;

const clearHistorySchema = z.object({
  teamId: z.uuid("Choose a valid team before clearing history."),
  roundId: z.union([z.uuid("Choose a valid history entry before clearing it."), z.literal("")]).optional(),
});

function readStringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function historyPath(teamId: string): string {
  return `/teams/${encodeURIComponent(teamId)}/history`;
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = clearHistorySchema.safeParse({
    teamId: form.get("teamId"),
    roundId: readStringField(form, "roundId"),
  });

  const fallbackTeamId = readStringField(form, "teamId");
  const fallbackPath = fallbackTeamId ? historyPath(fallbackTeamId) : "/dashboard";

  if (!parsed.success) {
    setHistoryFlash(context.cookies, {
      type: "history-clear-error",
      teamId: fallbackTeamId,
      message: parsed.error.issues[0]?.message ?? "Choose a valid history action.",
    });
    return context.redirect(fallbackPath);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    const roundId = parsed.data.roundId === "" ? null : (parsed.data.roundId ?? null);

    if (roundId) {
      await services.clearTeamHistoryEntry({
        teamId: parsed.data.teamId,
        roundId,
      });

      setHistoryFlash(context.cookies, {
        type: "history-cleared",
        teamId: parsed.data.teamId,
        message: "History entry cleared.",
      });
      return context.redirect(historyPath(parsed.data.teamId));
    }

    const result = await services.clearTeamHistory(parsed.data.teamId);
    setHistoryFlash(context.cookies, {
      type: "history-cleared",
      teamId: parsed.data.teamId,
      message:
        result.clearedCount === 0
          ? "No visible history to clear."
          : `${result.clearedCount} history entr${result.clearedCount === 1 ? "y" : "ies"} cleared.`,
    });
    return context.redirect(historyPath(parsed.data.teamId));
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't clear history right now.";

    setHistoryFlash(context.cookies, {
      type: "history-clear-error",
      teamId: parsed.data.teamId,
      message,
    });
    return context.redirect(historyPath(parsed.data.teamId));
  }
};
