"use client";

import { useCallback, useEffect, useRef } from "react";

// eslint-disable-next-line
const useDebounce = <T extends (...args: any[]) => any>(
  func: T,
  ms: number
) => {
  const funcRef = useRef(func);
  const timeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const debounce = useCallback(
    (...args: Parameters<T>) => {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        funcRef.current(...args);
      }, ms);
    },
    [ms]
  );

  useEffect(() => {
    funcRef.current = func;
  }, [func]);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  return debounce as T;
};

export default useDebounce;
