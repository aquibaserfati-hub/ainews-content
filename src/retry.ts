// withRetries — exponential backoff wrapper for flaky async calls.
// Backoff schedule (locked via /plan-eng-review on 2026-04-27): 5s, 30s, 90s.
// On final failure, throws the last error so the caller can decide what to do.
//
// Usage:
//   const result = await withRetries(() => callClaude(prompt), { max: 3 });
//
// The retry loop catches ALL thrown errors. If you want to bail early
// (e.g., HTTP 401 = auth, no point retrying), throw a `NoRetryError`.

export class NoRetryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "NoRetryError";
  }
}

export interface RetryOptions {
  max?: number;
  /**
   * Override the default backoff schedule. Length must be >= max - 1.
   * Each entry is the delay BEFORE the corresponding retry attempt
   * (i.e., index 0 = wait before retry #1).
   */
  backoffMs?: number[];
  /**
   * Optional logger. Defaults to console.warn for visibility in CI.
   */
  log?: (msg: string) => void;
  /**
   * Sleep function. Replaceable in tests so they don't actually wait.
   */
  sleep?: (ms: number) => Promise<void>;
}

// Default backoff schedule: 5s, 30s, 90s. Tuned for transient web-search
// failures and occasional malformed-JSON outputs from Claude.
const DEFAULT_BACKOFF_MS = [5_000, 30_000, 90_000];

// Rate-limit override. Anthropic's per-minute token-rate-limit windows
// are 60 seconds, so any retry on 429 needs to wait at least that long.
// We use 75s for headroom on top of the rolling window.
const RATE_LIMIT_BACKOFF_MS = 75_000;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const max = opts.max ?? 3;
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const log = opts.log ?? ((msg: string) => console.warn(msg));
  const sleep = opts.sleep ?? defaultSleep;

  if (max < 1) {
    throw new Error(`withRetries: max must be >= 1, got ${max}`);
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err instanceof NoRetryError) {
        throw err;
      }
      const isLastAttempt = attempt === max;
      if (isLastAttempt) {
        break;
      }
      // Rate-limit errors need a longer backoff than transient failures
      // because the rate-limit window is per-minute and the fixed
      // schedule's 5s/30s isn't long enough to clear it reliably.
      const baseDelay =
        backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1];
      const delay = isRateLimitError(err)
        ? Math.max(baseDelay, RATE_LIMIT_BACKOFF_MS)
        : baseDelay;
      const reason = isRateLimitError(err) ? "rate-limit" : "transient";
      log(
        `withRetries: attempt ${attempt}/${max} failed (${reason}: ${errMsg(err)}). Retrying in ${delay}ms.`,
      );
      await sleep(delay);
    }
  }
  throw new RetryExhaustedError(max, lastError);
}

/**
 * Is this a rate-limit (HTTP 429) error from the Anthropic SDK?
 * The SDK throws errors with a numeric `status` field and a JSON body
 * containing `{"type":"error","error":{"type":"rate_limit_error",...}}`.
 */
export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; message?: string };
  if (e.status === 429) return true;
  if (typeof e.message === "string" && /rate.?limit/i.test(e.message)) {
    return true;
  }
  return false;
}

export class RetryExhaustedError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: unknown,
  ) {
    super(
      `withRetries: ${attempts} attempts exhausted. Last error: ${errMsg(lastError)}`,
    );
    this.name = "RetryExhaustedError";
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
