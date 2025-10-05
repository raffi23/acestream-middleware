import { AxiosError } from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import { Agent } from "https";
import path from "path";
import { ChannelSearchResult } from "../types";
import { axiosBase } from "./axios";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const saveM3U8ToFile = (m3u8String: string, filename = "live.m3u8") => {
  const dirPath = path.join(__dirname, "../public");
  const filePath = path.join(dirPath, filename);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, m3u8String, { flag: "w" });
};

const generateM3U8 = (channelsMap: Map<string, ChannelSearchResult>, remote?: boolean) => {
  const categories = new Map<string, ChannelSearchResult[]>();

  for (const [, channel] of channelsMap.entries()) {
    if (!channel.infohash) continue;
    const cat = channel.category || "Other";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(channel);
  }

  let m3u8 = "#EXTM3U\n";
  for (const [category, channels] of categories.entries()) {
    for (const { name, infohash } of channels.sort((a, b) => {
      return a.name.localeCompare(b.name);
    })) {
      const streamUrl = !remote ? `http://192.168.1.254:6878/ace/getstream?id=${infohash}` : `https://stream.rhymecode.net/ace/getstream?id=${infohash}&p_token=xcdy2nk4.wxktwxqpkyfphk4itwcks4pekm`;
      m3u8 += `#EXTINF:-1 tvg-name="${name}" group-title="${category}",${name}\n${streamUrl}\n`;
    }
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
    "[us]",
    "[uk]",
    "Матч",
    "Setanta",
  ];

  const channels = new Map<string, ChannelSearchResult>();
  for (const query of queries) {
    try {
      const _channels = await searchAceChannels(query);

      for (const channel of _channels) {
        channels.set(channel.infohash, channel);
      }
    } catch (error) {
      console.log(`Error scraping ${query}:`, (error as AxiosError)?.message);
    }
  }

  return channels;
};

export const fetchPage = async (eventUrl: string) => {
  try {
    const httpsAgent = new Agent({ rejectUnauthorized: false });
    const { data } = await axiosBase.get<string>(eventUrl, {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36",
      },
      httpsAgent: httpsAgent,
      responseType: "text",
      maxRedirects: 3,
    });
    return data;
  } catch (error) {
    console.error(
      `Error fetching page: ${eventUrl}`,
      (error as AxiosError)?.code
    );
    return null;
  }
};

const extractLivetvsxLiveEvents = (page: string) => {
  const $ = cheerio.load(page);
  const root = $(
    "body > table > tbody > tr > td:nth-child(2) > table > tbody > tr:nth-child(4) > td > table > tbody > tr > td:nth-child(2) > table > tbody > tr > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td > table > tbody > tr > td > table:nth-child(5) > tbody > tr > td:nth-child(2) > table:nth-child(2)"
  );

  const events = root
    .find("a.live")
    .map((_, el) => {
      const name = $(el).text();
      const pathname = $(el).attr("href");
      return { name, pathname };
    })
    .get();

  const seen = new Set<string>();
  const uniqueEvents = [];
  for (const e of events) {
    if (!e.pathname) continue;
    const key = `${e.name}|${e.pathname}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEvents.push(e);
    }
  }

  return uniqueEvents.map((e) => ({
    name: e.name,
    url: "https://www.livetv.sx" + e.pathname,
  }));
};

const extractLivetvsxAceStreams = (page: string) => {
  const streams: {
    infohash: string;
    language: string;
    bitrate: string;
    rating: string;
  }[] = [];
  const $ = cheerio.load(page);
  const languages = $('tr:has(a[href^="acestream://"]) > td > img[title]');
  const bitrates = $('tr:has(a[href^="acestream://"]) > td.bitrate');
  const ratings = $('tr:has(a[href^="acestream://"]) > td.rate');
  const links = $('a[href^="acestream://"]');

  links.each((i, el) => {
    const link = $(el).attr("href");
    if (!link) return;

    const infohash = link.replace("acestream://", "");
    const language = languages.eq(i).attr("title") || "unknown";
    const bitrate = bitrates.eq(i).text().trim() || "0kbps";
    const rating = ratings.eq(i).text().trim() || "0%";

    streams.push({ infohash, language, bitrate, rating });
  });

  return streams;
};

export const scrapeLivetvsx = async (link: string) => {
  const page = await fetchPage(link);
  if (!page) {
    console.error("Failed to get https://livetv.sx");
    return new Map<string, ChannelSearchResult>();
  }

  const events = extractLivetvsxLiveEvents(page);
  const channels = new Map<string, ChannelSearchResult>();

  for (const event of events) {
    console.log("--------------------------------");
    console.log(`Processing event: ${event.name}`);
    const eventPage = await fetchPage(event.url);
    if (!eventPage) {
      console.error(`Failed to fetch event page: ${event.name}`);
      continue;
    }

    const streams = extractLivetvsxAceStreams(eventPage);
    console.log(`Found ${streams.length} streams for event: ${event.name}`);

    for (const stream of streams) {
      const { infohash, language, bitrate, rating } = stream;
      channels.set(infohash, {
        name: `[${language}] [${bitrate}] [${rating}] ${event.name}`,
        infohash,
        category: event.name,
      });
    }
  }

  return channels;
};

export const searchAceChannels = async (query: string) => {
  const queryData = new URLSearchParams({
    ...(typeof query === "string" && { q: query }),
  });

  const consutructUrl = `https://www.acestreamsearch.net/en/?${queryData}`;
  console.log("--------------------------------");
  console.log(`Processing search: ${query}`);
  await delay(2000);
  const data = await fetchPage(consutructUrl);
  if (!data) return [];

  const $ = cheerio.load(data);
  const extracted = $(".list-group-item").extract({
    streams: [
      {
        selector: "a",
        value: (el) => {
          const name = $(el).text();
          const infohash = $(el).attr("href")?.replace("acestream://", "");
          if (!infohash) return null;
          return { name, infohash };
        },
      },
    ],
  });

  console.log(`Found ${extracted.streams.length} streams for query: ${query}`);

  return extracted.streams.filter(Boolean);
};

export const generateAndSaveM3U8 = async () => {
  console.log("Generating M3U8...");

  const livetvsxFootballChannels = await scrapeLivetvsx(
    "https://livetv.sx/enx/allupcomingsports/1/"
  );
  const livetvsxRacingChannels = await scrapeLivetvsx(
    "https://livetv.sx/enx/allupcomingsports/7/"
  );

  const channels = new Map<string, ChannelSearchResult>([
    ...livetvsxFootballChannels,
    ...livetvsxRacingChannels,
  ]);

  console.log("Event count:", livetvsxFootballChannels.size);
  console.log(`Total streams: ${channels.size}`);

  const m3u8String = generateM3U8(channels);
  const m3u8StringLive = generateM3U8(channels, true);
  saveM3U8ToFile(m3u8StringLive, "live-remote.m3u8");
  saveM3U8ToFile(m3u8String);
  return m3u8String;
};
