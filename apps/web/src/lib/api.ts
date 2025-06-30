import { Channel, ChannelSearchItem, StreamGroup } from "@/types";
import axios, { axiosBase, axiosServer } from "./axios";
import { firstValidCategory, is18Plus } from "./utils";

export const queryStream = async (query: string, server?: boolean) => {
  return (server ? axiosServer : axios)
    .get<ChannelSearchItem[]>(`/search?${new URLSearchParams({ query })}`)
    .then((res) => res.data);
};

export const getAllStreamGroups = async (): Promise<StreamGroup[]> => {
  const { data } = await axiosBase.get<Channel[]>(
    "https://search.acestream.net/all?api_version=1&api_key=test_api_key"
  );

  const grouped: Record<string, Channel[]> = {};

  for (const channel of data) {
    if (is18Plus(channel)) {
      (grouped["18+"] ||= []).push(channel);
      continue;
    }

    const category =
      firstValidCategory(channel.categories)?.toLowerCase() || "uncategorized";
    (grouped[category] ||= []).push(channel);
  }

  const sortedGroups = Object.keys(grouped)
    .sort((a, b) => {
      if (a === "uncategorized" || a === "18+") return 1;
      if (b === "uncategorized" || b === "18+") return -1;
      return a.localeCompare(b);
    })
    .map((cat) => ({
      category: cat,
      channels: grouped[cat],
    })) satisfies StreamGroup[];

  return sortedGroups;
};
