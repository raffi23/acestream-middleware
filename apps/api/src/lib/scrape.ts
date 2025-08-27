import { AxiosError } from "axios";
import fs from "fs";
import path from "path";
import { ChannelSearchResult } from "../types";
import { searchChannels } from "./search";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const saveM3U8ToFile = (m3u8String: string, filename = "live.m3u8") => {
  const filePath = path.join(__dirname, "../public", filename);
  fs.writeFileSync(filePath, m3u8String);
};

const generateM3U8 = (channelsMap: Map<string, ChannelSearchResult>) => {
  let m3u8 = "#EXTM3U\n";

  for (const [_, { name, infohash }] of channelsMap.entries()) {
    if (!infohash) continue;

    const streamUrl = `http://192.168.1.254:6878/ace/getstream?id=${infohash}`;

    m3u8 += `#EXTINF:-1 tvg-name="${name}" group-title="Streams",${name}\n${streamUrl}\n`;
  }

  return m3u8;
};

export const scrapeChannels = async () => {
  const queries = [
    "bt sport",
    "bein sports",
    "fox sports",
    "premier sports",
    "sky sports",
    "sky sport f1",
    "shahid",
    "[us]",
    "[uk]",
    "Матч",
    "Setanta",
    "music",
    "armenia",
  ];

  const channels = new Map<string, ChannelSearchResult>();
  for (const query of queries) {
    try {
      const _channels = await searchChannels(query);

      for (const channel of _channels) {
        if (!channel.infohash) continue;
        channels.set(channel.infohash, channel);
      }

      await delay(2000);
    } catch (error) {
      console.log(`Error scraping ${query}:`, (error as AxiosError)?.message);
    }
  }

  console.log("Scraped channels:", channels.size);

  const m3u8 = generateM3U8(channels);
  saveM3U8ToFile(m3u8);
};
