import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { getTeamSurfaceHref, parseTeamSurface, setDashboardFlash } from "@/lib/dashboard-flash";

export const prerender = false;

const createTeamSchema = z.object({
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

  if (returnSurface === null) {
    setDashboardFlash(context.cookies, {
      type: "team-create-error",
      teamName: readStringField(form, "teamName").trim(),
      message: "Choose a valid return surface before creating a team.",
      surface: "dashboard",
      teamId: fallbackTeamId || undefined,
    });
    return context.redirect("/dashboard");
  }

  const parsed = createTeamSchema.safeParse({
    teamName: form.get("teamName"),
  });

  if (!parsed.success) {
    const submittedTeamName = readStringField(form, "teamName").trim();
    setDashboardFlash(context.cookies, {
      type: "team-create-error",
      teamName: submittedTeamName,
      message: parsed.error.issues[0]?.message ?? "Team name is required.",
      surface: returnSurface,
      teamId: fallbackTeamId || undefined,
    });
    return context.redirect(
      getTeamSurfaceHref({ surface: returnSurface, teamId: fallbackTeamId || null, hash: "create-team-next" }),
    );
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    const summary = await services.createTeam({ name: parsed.data.teamName });
    setDashboardFlash(context.cookies, {
      type: "team-created",
      teamId: summary.team.id,
      teamName: summary.team.name,
      message: `${summary.team.name} is ready. You can invite teammates below.`,
      surface: returnSurface,
    });
    return context.redirect(getTeamSurfaceHref({ surface: returnSurface, teamId: summary.team.id }));
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't create the team right now.";

    setDashboardFlash(context.cookies, {
      type: "team-create-error",
      teamName: parsed.data.teamName,
      message,
      surface: returnSurface,
      teamId: fallbackTeamId || undefined,
    });
    return context.redirect(
      getTeamSurfaceHref({ surface: returnSurface, teamId: fallbackTeamId || null, hash: "create-team-next" }),
    );
  }
};
