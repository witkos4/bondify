import type { AstroCookies } from "astro";

const GAME_FLASH_COOKIE = "bondify_game_flash";

type GameFlash =
  | {
      type: "game-started";
      teamId: string;
      gameSlug: string;
      message: string;
    }
  | {
      type: "game-start-error";
      teamId: string;
      gameSlug: string;
      message: string;
    }
  | {
      type: "response-submitted";
      teamId: string;
      gameSlug: string;
      message: string;
    }
  | {
      type: "response-submit-error";
      teamId: string;
      gameSlug: string;
      responseText: string;
      message: string;
    };

function serializeFlash(value: GameFlash): string {
  return JSON.stringify(value);
}

function deserializeFlash(value: string): GameFlash | null {
  try {
    return JSON.parse(value) as GameFlash;
  } catch {
    return null;
  }
}

export function setGameFlash(cookies: AstroCookies, value: GameFlash) {
  cookies.set(GAME_FLASH_COOKIE, serializeFlash(value), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60,
  });
}

export function consumeGameFlash(cookies: AstroCookies): GameFlash | null {
  const rawValue = cookies.get(GAME_FLASH_COOKIE)?.value;
  if (!rawValue) {
    return null;
  }

  cookies.delete(GAME_FLASH_COOKIE, { path: "/" });
  return deserializeFlash(rawValue);
}

export type { GameFlash };
