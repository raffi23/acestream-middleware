import { ChannelSearchResult } from "../types";
import { generateM3U8, saveM3U8ToFile } from "./m3u8";
import { searchAceChannels } from "./search-api";
import { wait } from "./utils";

const LOCAL_STREAM_BASE_URL = process.env.LOCAL_STREAM_BASE_URL || "";
const REMOTE_STREAM_BASE_URL = process.env.REMOTE_STREAM_BASE_URL || "";
const REMOTE_STREAM_TOKEN = process.env.REMOTE_STREAM_TOKEN || "";
const SEARCH_DELAY_MS = Number(process.env.SEARCH_DELAY_MS) || 1500;

const QUERIES: string[] = [
  "[uk]",
  "[us]",
  "ar",
  "hbo",
  "sport",
  "music",
  "movie",
];

const collectChannels = async () => {
  const channels = new Map<string, ChannelSearchResult>();

  for (const [queryIndex, query] of QUERIES.entries()) {
    if (queryIndex > 0) await wait(SEARCH_DELAY_MS);

    const results = await searchAceChannels(query);
    console.log(`Found ${results.length} streams for query: ${query}`);

    for (const result of results) {
      channels.set(result.infohash, {
        name: result.name,
        infohash: result.infohash,
        category: query,
      });
    }
  }

  return channels;
};

export const generateAndSaveM3U8 = async () => {
  console.log("Generating M3U8...");

  const channels = await collectChannels();
  console.log(`Total streams: ${channels.size}`);

  if (LOCAL_STREAM_BASE_URL) {
    const playlist = generateM3U8(channels, { baseUrl: LOCAL_STREAM_BASE_URL });
    saveM3U8ToFile(playlist, "live.m3u8");
  } else {
    console.warn("LOCAL_STREAM_BASE_URL not set — skipping live.m3u8");
  }

  if (REMOTE_STREAM_BASE_URL) {
    const playlist = generateM3U8(channels, {
      baseUrl: REMOTE_STREAM_BASE_URL,
      token: REMOTE_STREAM_TOKEN || undefined,
    });
    saveM3U8ToFile(playlist, "live-remote.m3u8");
  } else {
    console.warn("REMOTE_STREAM_BASE_URL not set — skipping live-remote.m3u8");
  }
};
