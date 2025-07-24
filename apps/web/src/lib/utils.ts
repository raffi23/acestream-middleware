import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateVLCLink(infohash: string, isLocal?: boolean) {
  const query = new URLSearchParams({
    id: infohash || "",
  });
  if (!isLocal) {
    query.set("p_token", process.env.PANGOLIN_TOKEN || "");
  }
  return `${
    isLocal ? "http://192.168.1.254:6878" : process.env.NEXT_PUBLIC_BACKEND_URL
  }/ace/getstream?${query}`;
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
