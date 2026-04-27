import { describe, expect, it, vi } from "vitest";
import {
  withRetries,
  NoRetryError,
  RetryExhaustedError,
} from "../src/retry.ts";

const noopSleep = (_ms: number) => Promise.resolve();
const noopLog = (_msg: string) => {};

describe("withRetries", () => {
  it("returns the result on first success (no retry needed)", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetries(fn, { sleep: noopSleep, log: noopLog });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and returns the eventual success", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 3) throw new Error(`flaky ${calls}`);
      return "eventually ok";
    });
    const result = await withRetries(fn, { sleep: noopSleep, log: noopLog });
    expect(result).toBe("eventually ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws RetryExhaustedError after max attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanently broken"));
    await expect(
      withRetries(fn, { max: 3, sleep: noopSleep, log: noopLog }),
    ).rejects.toThrow(RetryExhaustedError);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("preserves the last error inside RetryExhaustedError", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("specific message"));
    try {
      await withRetries(fn, { max: 2, sleep: noopSleep, log: noopLog });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RetryExhaustedError);
      const re = err as RetryExhaustedError;
      expect(re.attempts).toBe(2);
      expect((re.lastError as Error).message).toBe("specific message");
    }
  });

  it("does NOT retry when fn throws NoRetryError", async () => {
    const fn = vi.fn().mockRejectedValue(new NoRetryError("auth failure"));
    await expect(
      withRetries(fn, { max: 5, sleep: noopSleep, log: noopLog }),
    ).rejects.toThrow(NoRetryError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("uses the configured backoff schedule between attempts", async () => {
    const sleepCalls: number[] = [];
    const sleep = (ms: number) => {
      sleepCalls.push(ms);
      return Promise.resolve();
    };
    const fn = vi.fn().mockRejectedValue(new Error("flaky"));
    await expect(
      withRetries(fn, {
        max: 3,
        backoffMs: [100, 500, 9999],
        sleep,
        log: noopLog,
      }),
    ).rejects.toThrow(RetryExhaustedError);
    // 3 attempts = 2 sleeps in between (5s, 30s in default; 100, 500 here).
    expect(sleepCalls).toEqual([100, 500]);
  });

  it("rejects max < 1", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(
      withRetries(fn, { max: 0, sleep: noopSleep, log: noopLog }),
    ).rejects.toThrow("max must be >= 1");
  });
});
