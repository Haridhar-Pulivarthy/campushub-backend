/**
 * Loads campus resources, optionally filtered by type.
 */
import { useEffect, useState } from "react";

import { fetchResources } from "../api/campushubApi.ts";
import type { Resource, ResourceType } from "../types/api.ts";
import { getErrorMessage } from "../utils/errors.ts";

export type ResourcesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; resources: Resource[] };

export interface UseResourcesResult {
  state: ResourcesState;
  /** Re-run the request for the current filter. */
  retry: () => void;
}

/** The outcome of one request, tagged with the filter/attempt it answers. */
interface SettledRequest {
  key: string;
  state: Exclude<ResourcesState, { status: "loading" }>;
}

/** @param type - Resource type to filter by; undefined loads every resource. */
export function useResources(type?: ResourceType): UseResourcesResult {
  const [attempt, setAttempt] = useState<number>(0);
  const [settled, setSettled] = useState<SettledRequest | null>(null);
  const requestKey = `${type ?? "ALL"}:${attempt}`;

  useEffect((): (() => void) => {
    // When the filter changes (or a retry starts) before this request
    // finishes, the cleanup marks it stale so its late response is dropped
    // instead of overwriting the newer selection's results.
    let ignore = false;
    void fetchResources(type).then(
      (resources: Resource[]): void => {
        if (!ignore) {
          setSettled({
            key: requestKey,
            state: { status: "success", resources },
          });
        }
      },
      (err: unknown): void => {
        if (!ignore) {
          setSettled({
            key: requestKey,
            state: { status: "error", message: getErrorMessage(err) },
          });
        }
      },
    );
    return (): void => {
      ignore = true;
    };
  }, [type, requestKey]);

  // Anything not yet answered for the current key is still loading.
  const state: ResourcesState =
    settled !== null && settled.key === requestKey
      ? settled.state
      : { status: "loading" };

  return {
    state,
    retry: (): void => {
      setAttempt((n: number): number => n + 1);
    },
  };
}
