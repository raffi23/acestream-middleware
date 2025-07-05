import { useStore } from "@/store";
import { Channel } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateVLCLink(infohash: string) {
  const p_token = useStore.getState().access_token;
  const query = new URLSearchParams({
    p_token,
  });
  return `${process.env.NEXT_PUBLIC_BE_URL}/stream/${infohash}?${query}`;
}

export const is18Plus = (channel: Channel) => {
  return (
    (channel.name && channel.name.includes("18+")) ||
    (channel.categories &&
      (channel.categories.includes("18+") ||
        channel.categories.includes("erotic_18_plus")))
  );
};

export const firstValidCategory = (categories: string[]) => {
  if (!categories || categories.length === 0) return null;
  return categories.find((cat) => cat && cat.trim() !== "") || null;
};
