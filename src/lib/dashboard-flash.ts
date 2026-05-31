import type { AstroCookies } from "astro";
import type { TeamInviteCreateResult } from "@/types";

const DASHBOARD_FLASH_COOKIE = "bondify_dashboard_flash";

type DashboardFlash =
  | {
      type: "team-created";
      teamId: string;
      teamName: string;
      message: string;
    }
  | {
      type: "team-create-error";
      teamName: string;
      message: string;
    }
  | {
      type: "invite-results";
      teamId: string;
      submittedEmails: string[];
      results: TeamInviteCreateResult[];
      message: string;
    }
  | {
      type: "invite-accepted";
      teamId: string;
      message: string;
    }
  | {
      type: "invite-accept-error";
      inviteId: string;
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

export type { DashboardFlash };
