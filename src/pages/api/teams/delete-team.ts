import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { getTeamSurfaceHref, parseTeamSurface, setDashboardFlash } from "@/lib/dashboard-flash";

export const prerender = false;

const deleteTeamSchema = z.object({
  teamId: z.uuid("Choose a valid team before deleting it."),
  confirmationName: z.string(),
});

function readStringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const returnSurface = parseTeamSurface(form.get("surface"));
  const fallbackTeamId = readStringField(form, "teamId");
  const submittedConfirmationName = readStringField(form, "confirmationName").trim();

  if (returnSurface === null) {
    setDashboardFlash(context.cookies, {
      type: "team-delete-error",
      teamId: fallbackTeamId,
      confirmationName: submittedConfirmationName,
      message: "Choose a valid return surface before deleting a team.",
      surface: "dashboard",
    });
    return context.redirect("/dashboard");
  }

  const parsed = deleteTeamSchema.safeParse({
    teamId: form.get("teamId"),
    confirmationName: form.get("confirmationName"),
  });

  const errorRedirectTarget = getTeamSurfaceHref({
    surface: returnSurface,
    teamId: fallbackTeamId || null,
    hash: "danger-zone",
  });

  if (!parsed.success) {
    setDashboardFlash(context.cookies, {
      type: "team-delete-error",
      teamId: fallbackTeamId,
      confirmationName: submittedConfirmationName,
      message: parsed.error.issues[0]?.message ?? "Choose a valid team before deleting it.",
      surface: returnSurface,
    });
    return context.redirect(errorRedirectTarget);
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    const result = await services.deleteOwnedTeam({
      teamId: parsed.data.teamId,
      confirmationName: parsed.data.confirmationName,
    });

    setDashboardFlash(context.cookies, {
      type: "team-deleted",
      deletedTeamId: result.deletedTeamId,
      deletedTeamName: result.deletedTeamName,
      redirectTeamId: result.redirectTeamId,
      message: `${result.deletedTeamName} was deleted.`,
      surface: returnSurface,
    });

    const nextSurface = returnSurface === "management" && result.redirectTeamId ? "management" : "dashboard";
    return context.redirect(
      getTeamSurfaceHref({
        surface: nextSurface,
        teamId: result.redirectTeamId,
      }),
    );
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't delete this team right now.";

    setDashboardFlash(context.cookies, {
      type: "team-delete-error",
      teamId: parsed.data.teamId,
      confirmationName: parsed.data.confirmationName.trim(),
      message,
      surface: returnSurface,
    });
    return context.redirect(
      getTeamSurfaceHref({
        surface: returnSurface,
        teamId: parsed.data.teamId,
        hash: "danger-zone",
      }),
    );
  }
};
