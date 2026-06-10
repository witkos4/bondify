import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { getTeamSurfaceHref, parseTeamSurface, setDashboardFlash } from "@/lib/dashboard-flash";

export const prerender = false;

const inviteSchema = z.object({
  teamId: z.uuid("Choose a valid team before inviting teammates."),
  emails: z.string().trim().min(1, "Add at least one teammate email."),
});

function splitInviteEmails(input: string): string[] {
  return input
    .split(/[\r\n,]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function readStringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const returnSurface = parseTeamSurface(form.get("surface"));

  if (returnSurface === null) {
    setDashboardFlash(context.cookies, {
      type: "invite-results",
      teamId: readStringField(form, "teamId"),
      submittedEmails: splitInviteEmails(readStringField(form, "emails")),
      results: [],
      message: "Choose a valid return surface before inviting teammates.",
      surface: "dashboard",
    });
    return context.redirect("/dashboard");
  }

  const parsed = inviteSchema.safeParse({
    teamId: form.get("teamId"),
    emails: form.get("emails"),
  });

  const submittedEmails = splitInviteEmails(readStringField(form, "emails"));
  const fallbackTeamId = readStringField(form, "teamId");
  const redirectTarget = getTeamSurfaceHref({ surface: returnSurface, teamId: fallbackTeamId || null });

  if (!parsed.success) {
    setDashboardFlash(context.cookies, {
      type: "invite-results",
      teamId: fallbackTeamId,
      submittedEmails,
      results: [],
      message: parsed.error.issues[0]?.message ?? "Add at least one teammate email.",
      surface: returnSurface,
    });
    return context.redirect(redirectTarget);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    const results = await services.createPendingInvites({
      teamId: parsed.data.teamId,
      emails: splitInviteEmails(parsed.data.emails),
    });

    const createdCount = results.filter((result) => result.ok).length;
    const failedCount = results.length - createdCount;
    const message =
      failedCount > 0
        ? `${createdCount} invite${createdCount === 1 ? "" : "s"} created, ${failedCount} need${failedCount === 1 ? "s" : ""} attention.`
        : `${createdCount} invite${createdCount === 1 ? "" : "s"} created successfully.`;

    setDashboardFlash(context.cookies, {
      type: "invite-results",
      teamId: parsed.data.teamId,
      submittedEmails,
      results,
      message,
      surface: returnSurface,
    });
    return context.redirect(getTeamSurfaceHref({ surface: returnSurface, teamId: parsed.data.teamId }));
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't send invites right now.";

    setDashboardFlash(context.cookies, {
      type: "invite-results",
      teamId: parsed.data.teamId,
      submittedEmails,
      results: [],
      message,
      surface: returnSurface,
    });
    return context.redirect(getTeamSurfaceHref({ surface: returnSurface, teamId: parsed.data.teamId }));
  }
};
