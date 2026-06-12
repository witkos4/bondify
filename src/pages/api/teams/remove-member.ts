import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { getTeamSurfaceHref, parseTeamSurface, setDashboardFlash } from "@/lib/dashboard-flash";

export const prerender = false;

const removeMemberSchema = z.object({
  teamId: z.uuid("Choose a valid team before updating the roster."),
  membershipId: z.uuid("Choose a valid team member before removing them."),
});

function readStringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const returnSurface = parseTeamSurface(form.get("surface"));
  const fallbackTeamId = readStringField(form, "teamId");
  const fallbackMembershipId = readStringField(form, "membershipId");

  if (returnSurface === null) {
    setDashboardFlash(context.cookies, {
      type: "team-member-remove-error",
      teamId: fallbackTeamId,
      membershipId: fallbackMembershipId || undefined,
      message: "Choose a valid return surface before updating the roster.",
      surface: "dashboard",
    });
    return context.redirect("/dashboard");
  }

  const parsed = removeMemberSchema.safeParse({
    teamId: form.get("teamId"),
    membershipId: form.get("membershipId"),
  });

  const redirectTarget = getTeamSurfaceHref({
    surface: returnSurface,
    teamId: fallbackTeamId || null,
    hash: "team-roster",
  });

  if (!parsed.success) {
    setDashboardFlash(context.cookies, {
      type: "team-member-remove-error",
      teamId: fallbackTeamId,
      membershipId: fallbackMembershipId || undefined,
      message: parsed.error.issues[0]?.message ?? "Choose a valid team member before removing them.",
      surface: returnSurface,
    });
    return context.redirect(redirectTarget);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    const result = await services.removeTeamMember({
      teamId: parsed.data.teamId,
      membershipId: parsed.data.membershipId,
    });

    setDashboardFlash(context.cookies, {
      type: "team-member-removed",
      teamId: result.teamId,
      membershipId: result.membershipId,
      removedEmail: result.removedEmail,
      message: `${result.removedEmail} was removed from the team.`,
      surface: returnSurface,
    });
    return context.redirect(
      getTeamSurfaceHref({
        surface: returnSurface,
        teamId: result.teamId,
        hash: "team-roster",
      }),
    );
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't update the roster right now.";

    setDashboardFlash(context.cookies, {
      type: "team-member-remove-error",
      teamId: parsed.data.teamId,
      membershipId: parsed.data.membershipId,
      message,
      surface: returnSurface,
    });
    return context.redirect(
      getTeamSurfaceHref({
        surface: returnSurface,
        teamId: parsed.data.teamId,
        hash: "team-roster",
      }),
    );
  }
};
