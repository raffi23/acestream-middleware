import fs from "fs";
import path from "path";
import { ChannelSearchResult } from "../types";

type PlaylistOptions = {
  baseUrl: string;
  token?: string;
};

export const buildStreamUrl = (
  baseUrl: string,
  infohash: string,
  token?: string,
) => {
  const url = new URL(baseUrl);
  url.searchParams.set("id", infohash);
  if (token) url.searchParams.set("p_token", token);
  return url.toString();
};

const groupByCategory = (channels: Map<string, ChannelSearchResult>) => {
  const categories = new Map<string, ChannelSearchResult[]>();

  for (const [, channel] of channels.entries()) {
    if (!channel.infohash) continue;
    const categoryName = channel.category || "Other";
    if (!categories.has(categoryName)) categories.set(categoryName, []);
    categories.get(categoryName)!.push(channel);
  }

  return categories;
};

export const generateM3U8 = (
  channels: Map<string, ChannelSearchResult>,
  { baseUrl, token }: PlaylistOptions,
) => {
  const categories = groupByCategory(channels);

  const sortedCategories = [...categories.entries()].sort(([first], [second]) =>
    first.localeCompare(second),
  );

  let m3u8 = "#EXTM3U\n";
  for (const [category, categoryChannels] of sortedCategories) {
    const sortedChannels = categoryChannels.sort((first, second) =>
      first.name.localeCompare(second.name),
    );

    for (const { name, infohash } of sortedChannels) {
      const streamUrl = buildStreamUrl(baseUrl, infohash, token);
      m3u8 += `#EXTINF:-1 tvg-name="${name}" tvg-type="live" group-title="${category}",${name}\n${streamUrl}\n`;
    }
  }

  return m3u8;
};

export const saveM3U8ToFile = (
  m3u8String: string,
  filename = "live.m3u8",
) => {
  const dirPath = path.join(__dirname, "../public");
  const filePath = path.join(dirPath, filename);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, m3u8String, { flag: "w" });
};
