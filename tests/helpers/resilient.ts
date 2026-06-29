import type { PostgrestError } from "@supabase/supabase-js";

const DEFAULT_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 100;
const JITTER_MS = 25;

export interface RetryablePostgrestResult<T> {
  data: T;
  error: PostgrestError | null;
}

async function backoff(attempt: number) {
  const delayMs = BASE_BACKOFF_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * JITTER_MS);

  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function withRetry<T>(
  label: string,
  op: () => PromiseLike<RetryablePostgrestResult<T>>,
  attempts = DEFAULT_ATTEMPTS,
): Promise<RetryablePostgrestResult<T>> {
  if (attempts < 1) {
    throw new Error(`withRetry requires at least one attempt for ${label}.`);
  }

  let sawTransient = false;

  // Note: op() exceptions are not caught here. The Supabase JS client encodes network
  // errors as { data, error } rather than throwing, so catching throws would require a
  // separate classification path without a PG error code to discriminate on.
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await op();
    const error = result.error;

    if (!error) {
      return result;
    }

    if (!error.code) {
      sawTransient = true;

      if (attempt < attempts) {
        console.warn(`Retrying ${label} after transient error (attempt ${attempt}): ${error.message}`);
        await backoff(attempt);
        continue;
      }

      return result;
    }

    if (error.code === "23505" && sawTransient) {
      console.warn(`Treating duplicate on ${label} as success after a prior transient retry.`);
      return { data: result.data, error: null };
    }

    return result;
  }

  // unreachable — every loop iteration returns or continues; this throw satisfies the TypeScript type checker
  throw new Error(`withRetry exhausted for ${label}`);
}
