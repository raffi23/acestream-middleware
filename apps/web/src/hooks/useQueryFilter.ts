import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import useDebounce from "./useDebounce";
import { isShallowEqual } from "@/lib/utils";

export type QueryParam = Record<string, string | undefined>;

const getQuery = <T extends QueryParam>(state: T) => {
  const searchParams = new URLSearchParams(window.location.search);
  const updatedParams = new URLSearchParams(searchParams.toString());

  Object.entries(state).forEach(([key, value]) => {
    if (value === "" || value === undefined) {
      updatedParams.delete(key);
    } else {
      updatedParams.set(key, value);
    }
  });

  const equal = isShallowEqual(
    Object.fromEntries(searchParams.entries()),
    Object.fromEntries(updatedParams.entries())
  );

  return { query: updatedParams, hasChanged: !equal };
};

export function useQueryFilter<T extends QueryParam>(
  defaultValues: T,
  debounceMs?: number
) {
  const defaultValuesRef = useRef<T>(defaultValues);
  const router = useRouter();
  const [state, setState] = useState<T>(() => defaultValuesRef.current);
  const [isTransitioning, startTransition] = useTransition();

  const debouncedPushQuery = useDebounce((updated: T) => {
    const { query, hasChanged } = getQuery(updated);
    if (!hasChanged) return;

    startTransition(() => {
      router.push(`?${query}`, { scroll: false });
    });
  }, debounceMs ?? 300);

  const setFilter = useCallback(
    (
      data: Partial<
        Record<
          keyof T,
          | undefined
          | string
          | {
              value: string;
              canUpdate: boolean;
            }
        >
      >
    ) => {
      const allData: Record<string, string> = {};
      const validatedData: Record<string, string> = {};

      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === "string") {
          allData[key] = value;
          validatedData[key] = value;
        } else if (value) {
          allData[key] = value.value;
          validatedData[key] = value.canUpdate ? value.value : "";
        }
      });

      setState((prev) => {
        debouncedPushQuery({ ...prev, ...validatedData });
        return { ...prev, ...allData };
      });
    },
    [debouncedPushQuery]
  );

  useEffect(() => {
    setFilter(defaultValuesRef.current);
  }, [setFilter]);

  return { filter: state, setFilter, isTransitioning };
}
