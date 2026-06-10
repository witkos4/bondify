import type { AstroCookies } from "astro";
import type { TeamInviteCreateResult, TeamSurface } from "@/types";

const DASHBOARD_FLASH_COOKIE = "bondify_dashboard_flash";
const TEAM_SURFACES: TeamSurface[] = ["dashboard", "management"];

type DashboardFlash =
  | {
      type: "team-created";
      teamId: string;
      teamName: string;
      message: string;
      surface?: TeamSurface;
    }
  | {
      type: "team-create-error";
      teamName: string;
      message: string;
      surface?: TeamSurface;
      teamId?: string;
    }
  | {
      type: "invite-results";
      teamId: string;
      submittedEmails: string[];
      results: TeamInviteCreateResult[];
      message: string;
      surface?: TeamSurface;
    }
  | {
      type: "invite-accepted";
      teamId: string;
      message: string;
      surface?: TeamSurface;
    }
  | {
      type: "invite-accept-error";
      inviteId: string;
      message: string;
      surface?: TeamSurface;
      teamId?: string;
    }
  | {
      type: "emoji-check-in-submitted";
      teamId: string;
      sessionId: string;
      message: string;
    }
  | {
      type: "emoji-check-in-submit-error";
      teamId: string;
      sessionId: string;
      emojis: string[];
      message: string;
    }
  | {
      type: "emoji-check-in-revealed";
      teamId: string;
      sessionId: string;
      message: string;
    }
  | {
      type: "emoji-check-in-reveal-error";
      teamId: string;
      sessionId: string;
      message: string;
    };

function serializeFlash(value: DashboardFlash): string {
  return JSON.stringify(value);
}

function deserializeFlash(value: string): DashboardFlash | null {
  try {
    return JSON.parse(value) as DashboardFlash;
  } catch {
    return null;
  }
}

export function setDashboardFlash(cookies: AstroCookies, value: DashboardFlash) {
  cookies.set(DASHBOARD_FLASH_COOKIE, serializeFlash(value), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60,
  });
}

export function consumeDashboardFlash(cookies: AstroCookies): DashboardFlash | null {
  const rawValue = cookies.get(DASHBOARD_FLASH_COOKIE)?.value;
  if (!rawValue) {
    return null;
  }

  cookies.delete(DASHBOARD_FLASH_COOKIE, { path: "/" });
  return deserializeFlash(rawValue);
}

export function isTeamSurface(value: string): value is TeamSurface {
  return TEAM_SURFACES.includes(value as TeamSurface);
}

export function parseTeamSurface(value: FormDataEntryValue | null | undefined): TeamSurface | null {
  if (value == null || value === "") {
    return "dashboard";
  }

  return typeof value === "string" && isTeamSurface(value) ? value : null;
}

export function getTeamSurfaceHref(input: {
  surface: TeamSurface;
  teamId?: string | null;
  hash?: string | null;
}): string {
  const suffix = input.hash ? `#${input.hash.replace(/^#/, "")}` : "";
  const encodedTeamId = input.teamId ? encodeURIComponent(input.teamId) : null;

  if (input.surface === "management" && encodedTeamId) {
    return `/teams/${encodedTeamId}/manage${suffix}`;
  }

  if (encodedTeamId) {
    return `/dashboard?team=${encodedTeamId}${suffix}`;
  }

  return `/dashboard${suffix}`;
}

export type { DashboardFlash };
