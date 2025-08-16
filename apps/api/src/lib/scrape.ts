import path from "path";
import { ChannelSearchResult } from "../types";
import { searchChannels } from "./search";
import fs from "fs";

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
    "sky sport f1",
    "shahid",
    "[us]",
    "[uk]",
    "Матч",
    "Setanta",
    "music",
    "armenia",
  ];
  let promises: ReturnType<typeof searchChannels>[] = [];

  for (const query of queries) {
    promises.push(
      new Promise((resolve, reject) =>
        setTimeout(() => {
          searchChannels(query)
            .then((streams) => resolve(streams))
            .catch(reject);
        }, 6000)
      )
    );
  }

  try {
    const channels = new Map<string, ChannelSearchResult>();
    const streams = await Promise.all(promises).then((results) =>
      results.flat()
    );
    streams.forEach((stream) => {
      if (stream.infohash) {
        channels.set(stream.infohash, stream);
      }
    });

    console.log("Scraped channels:", channels.size);

    const m3u8 = generateM3U8(channels);
    saveM3U8ToFile(m3u8);
  } catch (error) {
    console.log("Error scraping channels:", error);
  }
};
