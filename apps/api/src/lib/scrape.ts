import { AxiosError } from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import { Agent } from "https";
import path from "path";
import { ChannelSearchResult } from "../types";
import { axiosBase } from "./axios";

const saveM3U8ToFile = (m3u8String: string, filename = "live.m3u8") => {
  const dirPath = path.join(__dirname, "../public");
  const filePath = path.join(dirPath, filename);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, m3u8String, { flag: "w" });
};

const generateM3U8 = (channelsMap: Map<string, ChannelSearchResult>) => {
  const categories = new Map<string, ChannelSearchResult[]>();

  for (const [, channel] of channelsMap.entries()) {
    if (!channel.infohash) continue;
    const cat = channel.category || "AcestreamSearch";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(channel);
  }

  let m3u8 = "#EXTM3U\n";
  for (const [category, channels] of categories.entries()) {
    for (const { name, infohash } of channels) {
      const streamUrl = `http://192.168.1.254:6878/ace/getstream?id=${infohash}`;
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
      timeout: 30000,
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
  const extracted = $(
    "body > table > tbody > tr > td:nth-child(2) > table > tbody > tr:nth-child(4) > td > table > tbody > tr > td:nth-child(2)"
  ).extract({
    events: [
      {
        selector: 'td:has(img[src*="live.gif"]) > a.live',
        value: (el) => {
          const name = $(el).text();
          const pathname = $(el).attr("href");
          return { name, pathname };
        },
      },
    ],
  });

  return extracted.events
    .filter((e) => Boolean(e.pathname))
    .map((e) => ({
      name: e.name,
      url: "https://www.livetv.sx" + e.pathname,
    }));
};

const extractLivetvsxAceStreams = (page: string) => {
  const streams: string[] = [];
  const $ = cheerio.load(page);
  $('a[href^="acestream://"]').each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    streams.push(href);
  });
  return streams.filter(Boolean);
};

export const scrapeLivetvsx = async () => {
  const footballUrl = "https://www.livetv.sx/enx/allupcomingsports/1/";
  const page = await fetchPage(footballUrl);
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

    let counter = 0;
    for (const stream of streams) {
      counter++;
      const infohash = stream.replace("acestream://", "");
      channels.set(infohash, {
        name: `(${counter}) - ${event.name}`,
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

  const searchedChannels = await scrapeChannels();
  const livetvsxChannels = await scrapeLivetvsx();

  const channels = new Map<string, ChannelSearchResult>([
    ...searchedChannels,
    ...livetvsxChannels,
  ]);

  console.log("Searched channels count:", searchedChannels.size);
  console.log("Livetvsx channels count:", livetvsxChannels.size);
  console.log(`Total unique channels: ${channels.size}`);

  const m3u8String = generateM3U8(channels);

  saveM3U8ToFile(m3u8String);
  return m3u8String;
};
