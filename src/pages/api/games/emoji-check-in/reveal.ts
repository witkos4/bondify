import { z } from "zod";
import type { APIRoute } from "astro";
import { setDashboardFlash } from "@/lib/dashboard-flash";
import { BondifyServiceError, createBondifyServices } from "@/lib/services/bondify";

export const prerender = false;

const revealEmojiCheckInSchema = z.object({
  teamId: z.uuid("Choose a valid team before revealing today's check-in."),
  sessionId: z.uuid("Choose a valid Emoji Check-In session before revealing."),
});

function readStringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function dashboardPath(teamId: string): string {
  return teamId ? `/dashboard?team=${encodeURIComponent(teamId)}#emoji-check-in` : "/dashboard";
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const parsed = revealEmojiCheckInSchema.safeParse({
    teamId: form.get("teamId"),
    sessionId: form.get("sessionId"),
  });

  const fallbackTeamId = readStringField(form, "teamId");
  const fallbackSessionId = readStringField(form, "sessionId");

  if (!parsed.success) {
    setDashboardFlash(context.cookies, {
      type: "emoji-check-in-reveal-error",
      teamId: fallbackTeamId,
      sessionId: fallbackSessionId,
      message: parsed.error.issues[0]?.message ?? "Choose a valid check-in before revealing.",
    });

    return context.redirect(dashboardPath(fallbackTeamId));
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    const summary = await services.revealTodayEmojiCheckIn({
      teamId: parsed.data.teamId,
      sessionId: parsed.data.sessionId,
    });

    setDashboardFlash(context.cookies, {
      type: "emoji-check-in-revealed",
      teamId: parsed.data.teamId,
      sessionId: summary.session.id,
      message: "The team mood is revealed.",
    });
  } catch (error) {
    const message =
      error instanceof BondifyServiceError ? error.message : "We couldn't reveal today's emoji check-in right now.";

    setDashboardFlash(context.cookies, {
      type: "emoji-check-in-reveal-error",
      teamId: parsed.data.teamId,
      sessionId: parsed.data.sessionId,
      message,
    });
  }

  return context.redirect(dashboardPath(parsed.data.teamId));
};
