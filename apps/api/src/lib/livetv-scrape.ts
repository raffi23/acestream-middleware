import axios, { AxiosError } from "axios";
import * as cheerio from "cheerio";
import { ChannelSearchResult } from "../types";
import { wait } from "./utils";

const LIVETV_BASE_URL = process.env.LIVETV_BASE_URL || "https://livetv.sx";
const LIVETV_LIST_PATH = "/enx/allupcoming/";
const LIVETV_DETAIL_DELAY_MS =
  Number(process.env.LIVETV_DETAIL_DELAY_MS) || 1000;
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type LiveEvent = {
  eventPath: string;
  name: string;
  category: string;
};

const fetchHtml = async (url: string) => {
  const { data } = await axios.get<string>(url, {
    timeout: REQUEST_TIMEOUT_MS,
    responseType: "text",
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  return data;
};

const extractLiveEvents = (html: string): LiveEvent[] => {
  const $ = cheerio.load(html);
  const events = new Map<string, LiveEvent>();

  // Each event is an <a class="live" href="/enx/eventinfo/..."> followed by a
  // sibling <a> containing live.gif — that sibling signals the event is on air.
  $('a.live[href^="/enx/eventinfo/"]').each((_index, element) => {
    const anchor = $(element);
    const eventPath = anchor.attr("href");
    if (!eventPath) return;
    if (events.has(eventPath)) return;

    const parentTd = anchor.closest("td");
    const hasLiveGif = parentTd.find('img[src*="live.gif"]').length > 0;
    if (!hasLiveGif) return;

    const name = anchor.text().replace(/\s+/g, " ").trim();
    if (!name) return;

    // The sport icon sits in the preceding <td> with alt="Sport. League"
    const iconAlt = parentTd
      .closest("tr")
      .find('img[src*="/icons/"]')
      .first()
      .attr("alt");
    const category = iconAlt ?? "Other";

    events.set(eventPath, { eventPath, name, category });
  });

  return [...events.values()];
};

const extractAcestreamInfohashes = (html: string): string[] => {
  const $ = cheerio.load(html);
  const infohashes = new Set<string>();

  $('a[href^="acestream://"]').each((_index, element) => {
    const href = $(element).attr("href") ?? "";
    const hash = href.replace("acestream://", "").toLowerCase();
    if (/^[a-f0-9]{40}$/.test(hash)) infohashes.add(hash);
  });

  return [...infohashes];
};

export const fetchLiveEvents = async (): Promise<LiveEvent[]> => {
  try {
    const listUrl = new URL(LIVETV_LIST_PATH, LIVETV_BASE_URL).toString();
    const html = await fetchHtml(listUrl);
    return extractLiveEvents(html);
  } catch (error) {
    console.error(
      "livetv: failed to fetch live events list:",
      (error as AxiosError)?.message,
    );
    return [];
  }
};

export const fetchEventInfohashes = async (
  eventPath: string,
): Promise<string[]> => {
  try {
    const detailUrl = new URL(eventPath, LIVETV_BASE_URL).toString();
    const html = await fetchHtml(detailUrl);
    return extractAcestreamInfohashes(html);
  } catch (error) {
    console.error(
      `livetv: failed to fetch event detail for ${eventPath}:`,
      (error as AxiosError)?.message,
    );
    return [];
  }
};

export const collectLiveEventChannels = async (): Promise<
  ChannelSearchResult[]
> => {
  const liveEvents = await fetchLiveEvents();
  console.log(`livetv: discovered ${liveEvents.length} live events`);

  const channels: ChannelSearchResult[] = [];

  for (const [eventIndex, liveEvent] of liveEvents.entries()) {
    if (eventIndex > 0) await wait(LIVETV_DETAIL_DELAY_MS);

    const infohashes = await fetchEventInfohashes(liveEvent.eventPath);
    if (infohashes.length === 0) continue;

    for (const [streamIndex, infohash] of infohashes.entries()) {
      const channelName =
        infohashes.length > 1
          ? `${liveEvent.name} #${streamIndex + 1}`
          : liveEvent.name;
      channels.push({
        name: channelName,
        infohash,
        category: liveEvent.category,
      });
    }
  }

  console.log(`livetv: collected ${channels.length} acestream channels`);
  return channels;
};
