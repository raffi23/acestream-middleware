import path from "path";
import { ChannelSearchResult } from "../types";
import { searchChannels } from "./search";
import fs from "fs";
import { AxiosError } from "axios";

function saveM3U8ToFile(m3u8String: string, filename = "live.m3u8") {
  const filePath = path.join(__dirname, "../public", filename);
  fs.writeFileSync(filePath, m3u8String);
}

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
    "shahid",
    "[us]",
    "[uk]",
  ];
  const channels = new Map<string, ChannelSearchResult>();
  for (const query of queries) {
    try {
      const streams = await searchChannels(query);
      streams.forEach((stream) => {
        if (stream.infohash) {
          channels.set(stream.infohash, stream);
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(
        `Error searching channels for query: ${query}`,
        (error as AxiosError).code,
        (error as AxiosError).status,
        (error as AxiosError).message,
        (error as AxiosError).response?.status,
        (error as AxiosError).response?.data
      );
    }
  }

  console.log("Scraped channels:", channels.size);

  const m3u8 = generateM3U8(channels);
  saveM3U8ToFile(m3u8);
};
