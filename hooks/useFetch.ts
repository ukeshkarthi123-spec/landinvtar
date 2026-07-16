/**
 * Custom hook for data fetching with proper error handling, cleanup, and timeout management
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { withTimeoutAndRetry } from '@/lib/api-utils';

interface UseFetchOptions {
  enabled?: boolean;
  timeoutMs?: number;
  retries?: number;
  onError?: (error: Error) => void;
}

interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching data with automatic cleanup and timeout handling
 */
export function useFetch<T>(
  fetchFn: () => Promise<T>,
  options: UseFetchOptions = {}
): UseFetchState<T> {
  const { enabled = true, timeoutMs = 15000, retries = 2, onError } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const isMounted = useRef(true);
  const abortController = useRef<AbortController | null>(null);

  const performFetch = useCallback(async () => {
    if (!enabled || !isMounted.current) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      abortController.current = new AbortController();

      const result = await withTimeoutAndRetry(fetchFn, {
        timeoutMs,
        maxAttempts: retries,
      });

      if (isMounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (isMounted.current) {
        setError(error);
        setData(null);
        onError?.(error);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [fetchFn, enabled, timeoutMs, retries, onError]);

  useEffect(() => {
    isMounted.current = true;
    performFetch();

    return () => {
      isMounted.current = false;
      abortController.current?.abort();
    };
  }, [performFetch]);

  return {
    data,
    loading,
    error,
    refetch: performFetch,
  };
}

/**
 * Hook for executing multiple data fetches in parallel with proper error handling
 */
export function useMultiFetch<T extends Record<string, Promise<any>>>(
  fetches: T,
  options: Omit<UseFetchOptions, 'onError'> & {
    onErrors?: (errors: Record<keyof T, Error | null>) => void;
  } = {}
): {
  data: { [K in keyof T]: Awaited<T[K]> | null };
  loading: boolean;
  errors: Record<keyof T, Error | null>;
  refetch: () => Promise<void>;
} {
  const { enabled = true, timeoutMs = 15000, retries = 2, onErrors } = options;

  const [data, setData] = useState<{ [K in keyof T]: Awaited<T[K]> | null }>({} as any);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<keyof T, Error | null>>({} as any);

  const isMounted = useRef(true);

  const performFetch = useCallback(async () => {
    if (!enabled || !isMounted.current) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const entries = Object.entries(fetches) as [string, Promise<any>][];
    const results: Record<string, any> = {};
    const fetchErrors: Record<string, Error | null> = {};

    await Promise.all(
      entries.map(async ([key, promise]) => {
        try {
          const result = await withTimeoutAndRetry(
            () => promise,
            { timeoutMs, maxAttempts: retries }
          );
          if (isMounted.current) {
            results[key] = result;
            fetchErrors[key] = null;
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          if (isMounted.current) {
            results[key] = null;
            fetchErrors[key] = error;
          }
        }
      })
    );

    if (isMounted.current) {
      setData(results as any);
      setErrors(fetchErrors as any);
      onErrors?.(fetchErrors as any);
      setLoading(false);
    }
  }, [fetches, enabled, timeoutMs, retries, onErrors]);

  useEffect(() => {
    isMounted.current = true;
    performFetch();

    return () => {
      isMounted.current = false;
    };
  }, [performFetch]);

  return {
    data,
    loading,
    errors,
    refetch: performFetch,
  };
}
