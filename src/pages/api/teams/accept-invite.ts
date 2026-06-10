import { z } from "zod";
import type { APIRoute } from "astro";
import { createBondifyServices, BondifyServiceError } from "@/lib/services/bondify";
import { getTeamSurfaceHref, parseTeamSurface, setDashboardFlash } from "@/lib/dashboard-flash";

export const prerender = false;

const acceptInviteSchema = z.object({
  inviteId: z.uuid("Choose a valid invite before accepting."),
});

function readStringField(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const returnSurface = parseTeamSurface(form.get("surface"));

  if (returnSurface === null) {
    setDashboardFlash(context.cookies, {
      type: "invite-accept-error",
      inviteId: readStringField(form, "inviteId"),
      message: "Choose a valid return surface before accepting an invite.",
      surface: "dashboard",
    });
    return context.redirect("/dashboard");
  }

  const parsed = acceptInviteSchema.safeParse({
    inviteId: form.get("inviteId"),
  });

  const fallbackInviteId = readStringField(form, "inviteId");

  if (!parsed.success) {
    setDashboardFlash(context.cookies, {
      type: "invite-accept-error",
      inviteId: fallbackInviteId,
      message: parsed.error.issues[0]?.message ?? "Choose a valid invite before accepting.",
      surface: returnSurface,
    });
    return context.redirect(getTeamSurfaceHref({ surface: returnSurface }));
  }

  const services = createBondifyServices({
    requestHeaders: context.request.headers,
    cookies: context.cookies,
  });

  try {
    const result = await services.acceptInvite({ inviteId: parsed.data.inviteId });
    setDashboardFlash(context.cookies, {
      type: "invite-accepted",
      teamId: result.membership.teamId,
      message: `You're in. The invited team is now available from your dashboard.`,
      surface: returnSurface,
    });
    return context.redirect(getTeamSurfaceHref({ surface: returnSurface, teamId: result.membership.teamId }));
  } catch (error) {
    const message = error instanceof BondifyServiceError ? error.message : "We couldn't accept this invite right now.";

    setDashboardFlash(context.cookies, {
      type: "invite-accept-error",
      inviteId: parsed.data.inviteId,
      message,
      surface: returnSurface,
    });
    return context.redirect(getTeamSurfaceHref({ surface: returnSurface }));
  }
};
