/**
 * API utility functions for handling timeouts, retries, and error recovery
 */

/**
 * Wraps a promise with a timeout mechanism
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutError - Custom error message
 * @returns Promise that rejects if timeout is exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000,
  timeoutError: string = 'Request timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    ),
  ]);
}

/**
 * Retries a promise-returning function with exponential backoff
 * @param fn - Function that returns a promise
 * @param maxAttempts - Maximum number of attempts
 * @param delayMs - Initial delay between retries
 * @returns Promise resolving to the result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt === maxAttempts) break;

      // Exponential backoff
      const delay = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Combines timeout and retry logic
 * @param fn - Function that returns a promise
 * @param options - Configuration options
 * @returns Promise resolving to the result
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  options: {
    timeoutMs?: number;
    maxAttempts?: number;
    initialDelayMs?: number;
  } = {}
): Promise<T> {
  const { timeoutMs = 15000, maxAttempts = 2, initialDelayMs = 500 } = options;

  return withRetry(
    () => withTimeout(fn(), timeoutMs),
    maxAttempts,
    initialDelayMs
  );
}

/**
 * Safe async function that ensures cleanup even on error
 * @param fn - Async function to execute
 * @param onFinally - Cleanup function to always execute
 * @returns Promise from fn
 */
export async function withCleanup<T>(
  fn: () => Promise<T>,
  onFinally: () => void | Promise<void>
): Promise<T> {
  try {
    return await fn();
  } finally {
    await onFinally();
  }
}

/**
 * Handles errors with fallback value
 * @param promise - Promise to handle
 * @param fallback - Fallback value on error
 * @returns Promise resolving to either result or fallback
 */
export function withFallback<T>(
  promise: Promise<T>,
  fallback: T
): Promise<T> {
  return promise.catch(() => fallback);
}

/**
 * Creates an abort-friendly async operation tracker
 */
export class AsyncOperationTracker {
  private operations: Map<string, Promise<any>> = new Map();
  private aborted: Set<string> = new Set();

  /**
   * Track an operation
   */
  track<T>(key: string, promise: Promise<T>): Promise<T> {
    this.operations.set(key, promise);
    return promise
      .finally(() => this.operations.delete(key))
      .then(result => {
        if (this.aborted.has(key)) {
          throw new Error('Operation aborted');
        }
        return result;
      });
  }

  /**
   * Abort a specific operation
   */
  abort(key: string): void {
    this.aborted.add(key);
  }

  /**
   * Abort all operations
   */
  abortAll(): void {
    this.operations.forEach((_, key) => this.abort(key));
  }

  /**
   * Check if operation is still pending
   */
  isPending(key: string): boolean {
    return this.operations.has(key);
  }

  /**
   * Clean up all resources
   */
  cleanup(): void {
    this.abortAll();
    this.operations.clear();
    this.aborted.clear();
  }
}
