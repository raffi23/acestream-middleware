import { Channel } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateVLCLink(infohash: string) {
  return `${process.env.NEXT_PUBLIC_HOST_URL}/stream/http/${infohash}?p_token=z8oy3qv2.zvgqu5zbudjdkzih7q6abtrtk4`;
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
