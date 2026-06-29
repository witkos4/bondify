import type { PostgrestError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withRetry, type RetryablePostgrestResult } from "./resilient";

function postgrestError(message: string, code = ""): PostgrestError {
  return {
    code,
    details: "",
    hint: "",
    message,
    name: "PostgrestError",
  } as PostgrestError;
}

function queuedOp<T>(results: RetryablePostgrestResult<T>[]) {
  let index = 0;

  return vi.fn(() => {
    const result = results.at(index);
    index += 1;

    if (result === undefined) {
      throw new Error("Unexpected extra retry attempt.");
    }

    return Promise.resolve(result);
  });
}

async function flushRetries<T>(promise: Promise<T>) {
  await vi.runAllTimersAsync();
  return promise;
}

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries transient no-code errors and resolves with a later success", async () => {
    const success = { data: "ok", error: null };
    const op = queuedOp([
      { data: null, error: postgrestError("upstream invalid response") },
      { data: null, error: postgrestError("upstream invalid response again") },
      success,
    ]);

    const resultPromise = withRetry("read profile", op);

    await expect(flushRetries(resultPromise)).resolves.toBe(success);
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("returns the final transient error after exhausting the attempt budget", async () => {
    const finalError = { data: null, error: postgrestError("still upstream") };
    const op = queuedOp([
      { data: null, error: postgrestError("upstream once") },
      { data: null, error: postgrestError("upstream twice") },
      finalError,
    ]);

    const resultPromise = withRetry("create team", op);

    await expect(flushRetries(resultPromise)).resolves.toBe(finalError);
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("returns a coded 42501 error immediately without retrying", async () => {
    const denied = { data: null, error: postgrestError("permission denied", "42501") };
    const op = queuedOp([denied]);

    await expect(withRetry("foreign insert", op)).resolves.toBe(denied);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("returns a first-attempt 23505 duplicate as an error", async () => {
    const duplicate = { data: null, error: postgrestError("duplicate key", "23505") };
    const op = queuedOp([duplicate]);

    await expect(withRetry("create membership", op)).resolves.toBe(duplicate);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("coerces a 23505 duplicate to success only after a prior transient", async () => {
    const duplicateAfterTransient = { data: null, error: postgrestError("duplicate key", "23505") };
    const op = queuedOp([
      { data: null, error: postgrestError("upstream committed but failed") },
      duplicateAfterTransient,
    ]);

    const resultPromise = withRetry("create team", op);

    await expect(flushRetries(resultPromise)).resolves.toEqual({ data: null, error: null });
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("passes through an immediate success without retrying", async () => {
    const success = { data: { id: "template-id" }, error: null };
    const op = queuedOp([success]);

    await expect(withRetry("read template", op)).resolves.toBe(success);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("throws synchronously when attempts is less than 1", async () => {
    const op = vi.fn();

    await expect(withRetry("invalid", op, 0)).rejects.toThrow("withRetry requires at least one attempt for invalid.");
    expect(op).not.toHaveBeenCalled();
  });
});
