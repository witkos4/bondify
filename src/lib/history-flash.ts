import type { AstroCookies } from "astro";

const HISTORY_FLASH_COOKIE = "bondify_history_flash";

type HistoryFlash =
  | {
      type: "history-cleared";
      teamId: string;
      message: string;
    }
  | {
      type: "history-clear-error";
      teamId: string;
      message: string;
    };

function serializeFlash(value: HistoryFlash): string {
  return JSON.stringify(value);
}

function deserializeFlash(value: string): HistoryFlash | null {
  try {
    return JSON.parse(value) as HistoryFlash;
  } catch {
    return null;
  }
}

export function setHistoryFlash(cookies: AstroCookies, value: HistoryFlash) {
  cookies.set(HISTORY_FLASH_COOKIE, serializeFlash(value), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60,
  });
}

export function consumeHistoryFlash(cookies: AstroCookies): HistoryFlash | null {
  const rawValue = cookies.get(HISTORY_FLASH_COOKIE)?.value;
  if (!rawValue) {
    return null;
  }

  cookies.delete(HISTORY_FLASH_COOKIE, { path: "/" });
  return deserializeFlash(rawValue);
}

export type { HistoryFlash };
