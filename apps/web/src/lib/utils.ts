import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateVLCLink(infohash: string) {
  const query = new URLSearchParams({
    p_token: process.env.PANGOLIN_TOKEN || "",
  });
  return `${process.env.NEXT_PUBLIC_BACKEND_URL}/stream/${infohash}?${query}`;
}

export const isShallowEqual = (
  // eslint-disable-next-line
  a: Record<string, any>,
  // eslint-disable-next-line
  b: Record<string, any>
) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
};
