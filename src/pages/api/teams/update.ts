import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { getTeamSurfaceHref, parseTeamSurface, setDashboardFlash } from "@/lib/dashboard-flash";

export const prerender = false;

const updateTeamSchema = z.object({
  teamId: z.uuid("Choose a valid team before updating it."),
  teamName: z.string().trim().min(1, "Team name is required").max(80, "Team name is too long"),
});

function readStringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const returnSurface = parseTeamSurface(form.get("surface"));
  const fallbackTeamId = readStringField(form, "teamId");
  const submittedTeamName = readStringField(form, "teamName").trim();

  if (returnSurface !== "management") {
    setDashboardFlash(context.cookies, {
      type: "team-update-error",
      teamId: fallbackTeamId,
      teamName: submittedTeamName,
      message: "Choose the team management surface before updating a team.",
      surface: "dashboard",
    });
    return context.redirect("/dashboard");
  }

  const parsed = updateTeamSchema.safeParse({
    teamId: form.get("teamId"),
    teamName: form.get("teamName"),
  });

  const errorRedirectTarget = getTeamSurfaceHref({
    surface: "management",
    teamId: fallbackTeamId || null,
    hash: "edit-team-name",
  });

  if (!parsed.success) {
    setDashboardFlash(context.cookies, {
      type: "team-update-error",
      teamId: fallbackTeamId,
      teamName: submittedTeamName,
      message: parsed.error.issues[0]?.message ?? "Team name is required.",
      surface: "management",
    });
    return context.redirect(errorRedirectTarget);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    const summary = await services.updateTeam({
      teamId: parsed.data.teamId,
      name: parsed.data.teamName,
    });

    setDashboardFlash(context.cookies, {
      type: "team-updated",
      teamId: summary.team.id,
      teamName: summary.team.name,
      message: `${summary.team.name} was renamed successfully.`,
      surface: "management",
    });

    return context.redirect(getTeamSurfaceHref({ surface: "management", teamId: summary.team.id }));
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't update this team right now.";

    setDashboardFlash(context.cookies, {
      type: "team-update-error",
      teamId: parsed.data.teamId,
      teamName: parsed.data.teamName,
      message,
      surface: "management",
    });
    return context.redirect(
      getTeamSurfaceHref({ surface: "management", teamId: parsed.data.teamId, hash: "edit-team-name" }),
    );
  }
};
