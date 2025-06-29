"use client";

import { type RefObject, useEffect, useRef } from "react";

type OuterClickEventName = "mousedown" | "touchstart";

const useOuterClick = function <
  T extends HTMLElement,
  K extends HTMLElement = HTMLElement
>(callback: () => void) {
  const callbackRef = useRef<() => void>(undefined); // initialize mutable ref, which stores callback
  const innerRef = useRef<T>(undefined); // returned to client, who marks "border" element
  const excludeRef = useRef<K>(undefined); // element to exclude from triggering an outer click

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    //determine which events to use
    const eventName: OuterClickEventName =
      "ontouchstart" in document.documentElement ? "touchstart" : "mousedown";

    document.addEventListener(eventName, handleClick);
    return () => document.removeEventListener(eventName, handleClick);

    function handleClick(e: MouseEvent | TouchEvent) {
      const target = e.target as HTMLElement;

      if (!innerRef.current || !callbackRef.current) return;

      const hasClickedOutside =
        !innerRef.current.contains(target) &&
        (excludeRef.current ? !excludeRef.current.contains(target) : true);

      if (hasClickedOutside) {
        callbackRef.current();
      }
    }
  }, []);

  return [innerRef, excludeRef] as [RefObject<T>, RefObject<K>]; // convenience for client (doesn't need to init ref himself)
};

export default useOuterClick;
