import { z } from "zod";
import type { APIRoute } from "astro";
import { setDashboardFlash } from "@/lib/dashboard-flash";
import { BondifyServiceError, createBondifyServices } from "@/lib/services/bondify";

export const prerender = false;

const submitEmojiCheckInSchema = z.object({
  teamId: z.uuid("Choose a valid team before submitting today's check-in."),
  sessionId: z.uuid("Choose a valid Emoji Check-In session before submitting."),
  emojis: z
    .array(z.string().trim().min(1, "Choose at least one emoji."))
    .min(1, "Choose at least one emoji.")
    .max(3, "Choose no more than three emojis."),
});

function readStringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function readEmojiFields(form: FormData): string[] {
  return form
    .getAll("emojis")
    .map((value) => (typeof value === "string" ? value : ""))
    .filter((value) => value.length > 0);
}

function dashboardPath(teamId: string): string {
  return teamId ? `/dashboard?team=${encodeURIComponent(teamId)}#emoji-check-in` : "/dashboard";
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = submitEmojiCheckInSchema.safeParse({
    teamId: form.get("teamId"),
    sessionId: form.get("sessionId"),
    emojis: form.getAll("emojis"),
  });

  const fallbackTeamId = readStringField(form, "teamId");
  const fallbackSessionId = readStringField(form, "sessionId");
  const fallbackEmojis = readEmojiFields(form);

  if (!parsed.success) {
    setDashboardFlash(context.cookies, {
      type: "emoji-check-in-submit-error",
      teamId: fallbackTeamId,
      sessionId: fallbackSessionId,
      emojis: fallbackEmojis,
      message: parsed.error.issues[0]?.message ?? "Choose between one and three emojis.",
    });

    return context.redirect(dashboardPath(fallbackTeamId));
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    const state = await services.submitTodayEmojiCheckIn({
      teamId: parsed.data.teamId,
      emojis: parsed.data.emojis,
    });

    setDashboardFlash(context.cookies, {
      type: "emoji-check-in-submitted",
      teamId: parsed.data.teamId,
      sessionId: state.session.id,
      message: "Your emoji check-in is saved. Reveal the team mood when everyone is ready.",
    });
  } catch (error) {
    const message =
      error instanceof BondifyServiceError ? error.message : "We couldn't save today's emoji check-in right now.";

    setDashboardFlash(context.cookies, {
      type: "emoji-check-in-submit-error",
      teamId: parsed.data.teamId,
      sessionId: parsed.data.sessionId,
      emojis: parsed.data.emojis,
      message,
    });
  }

  return context.redirect(dashboardPath(parsed.data.teamId));
};
