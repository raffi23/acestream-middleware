import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { isShallowEqual } from "@/lib/utils";

import useDebounce from "./useDebounce";

export type QueryParam = Record<string, string | undefined>;

const getQuery = <T extends QueryParam>(state: T) => {
  const query = new URLSearchParams(
    Object.entries(state).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        if (value === "" || value === undefined) return acc;
        acc[key] = value;
        return acc;
      },
      {}
    )
  );
  return query;
};

export function useQueryFilter<T extends QueryParam>(
  defaultValues: T,
  debounceMs?: number
) {
  const defaultValuesRef = useRef<T>(defaultValues);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isTransitioning, startTransition] = useTransition();
  const [state, setState] = useState<T>(() => defaultValuesRef.current);
  const adjustedState = useMemo(() => {
    let updated = [];
    const changed = !isShallowEqual(defaultValuesRef.current, state);
    if (!changed) {
      updated = [
        ...Object.entries(defaultValuesRef.current),
        ...Object.entries(state),
        ...searchParams.entries(),
      ];
    } else {
      updated = [
        ...Object.entries(defaultValuesRef.current),
        ...searchParams.entries(),
        ...Object.entries(state),
      ];
    }
    return Object.fromEntries(
      updated.filter(([_, value]) => value !== null && value !== undefined)
    ) as T;
  }, [searchParams, state]);

  const debouncedPushQuery = useDebounce((updated: T) => {
    const query = getQuery(updated);
    startTransition(() => {
      router.replace(`?${query}`, { scroll: false });
    });
  }, debounceMs ?? 300);

  const setFilter = useCallback(
    (data: Partial<T>, stateOnly?: boolean) => {
      setState((prev) => {
        const updated = { ...prev, ...data };
        if (!stateOnly) debouncedPushQuery(updated);
        return updated;
      });
    },
    [debouncedPushQuery]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setFilter({ ...defaultValuesRef.current, ...Object.fromEntries(params) });
  }, [setFilter]);

  return { filter: adjustedState, setFilter, isTransitioning };
}
