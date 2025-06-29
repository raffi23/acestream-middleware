import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateVLCLink(infohash: string) {
  return `https://ace.rhymecode.net/stream/http/${infohash}?p_token=z8oy3qv2.zvgqu5zbudjdkzih7q6abtrtk4`;
}
