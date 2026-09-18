import axios from "axios";
import fs from "fs";
import path from "path";
import { ChannelSearchResult } from "../types";

const IPTV_CHANNELS_URL =
  process.env.IPTV_CHANNELS_URL || "https://iptv-org.github.io/api/channels.json";
const IPTV_LOGOS_URL =
  process.env.IPTV_LOGOS_URL || "https://iptv-org.github.io/api/logos.json";
const CACHE_FILE =
  process.env.IPTV_LOGO_CACHE_FILE ||
  path.join(__dirname, "../public/iptv-logo-cache.json");
const REFRESH_MS = Number(process.env.IPTV_LOGO_REFRESH_MS) || 86_400_000;
const REQUEST_TIMEOUT_MS = 20_000;

type IptvChannel = {
  id: string;
  name: string;
  alt_names?: string[];
  country?: string;
};

type IptvLogo = {
  channel: string;
  in_use?: boolean;
  format?: string | null;
  url: string;
};

type LogoCache = {
  fetchedAt: number;
  channels: IptvChannel[];
  logos: IptvLogo[];
};

type LogoMatch = {
  tvgId?: string;
  logo?: string;
};

let catalogPromise: Promise<LogoCache | null> | undefined;
let catalogLoadedAt = 0;
let validatedCatalogFetchedAt = 0;
const reachableLogoUrls = new Set<string>();
const unreachableLogoUrls = new Set<string>();

const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const countryCodeFromName = (name: string) => {
  const match = name.match(/\[([a-z]{2})\]/i);
  return match?.[1]?.toUpperCase();
};

const countryAliases: Record<string, string> = {
  UK: "GB",
  EN: "GB",
  EL: "GR",
};

const normalizedBaseName = (value: string) => {
  const withoutBracket = value.replace(/\s*\[[^\]]+\]/g, " ");
  return normalize(withoutBracket)
    .replace(/\b(?:hd|fhd|uhd|sd|4k|8k)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
};

const readCache = (): LogoCache | null => {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as LogoCache;
    if (
      typeof parsed.fetchedAt !== "number" ||
      !Array.isArray(parsed.channels) ||
      !Array.isArray(parsed.logos)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveCache = (cache: LogoCache) => {
  const directory = path.dirname(CACHE_FILE);
  const temporaryFile = `${CACHE_FILE}.${process.pid}.tmp`;
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(temporaryFile, `${JSON.stringify(cache)}\n`, "utf8");
    fs.renameSync(temporaryFile, CACHE_FILE);
  } catch (error) {
    console.warn("iptv-org: could not save logo cache:", (error as Error).message);
    try {
      fs.rmSync(temporaryFile, { force: true });
    } catch {
      // Cache persistence is best effort.
    }
  }
};

const fetchCatalog = async (): Promise<LogoCache | null> => {
  try {
    const [channelsResponse, logosResponse] = await Promise.all([
      axios.get<IptvChannel[]>(IPTV_CHANNELS_URL, {
        timeout: REQUEST_TIMEOUT_MS,
      }),
      axios.get<IptvLogo[]>(IPTV_LOGOS_URL, { timeout: REQUEST_TIMEOUT_MS }),
    ]);

    const cache: LogoCache = {
      fetchedAt: Date.now(),
      channels: channelsResponse.data,
      logos: logosResponse.data,
    };
    saveCache(cache);
    console.log(`iptv-org: refreshed ${cache.channels.length} channels and ${cache.logos.length} logos`);
    return cache;
  } catch (error) {
    console.warn("iptv-org: failed to refresh logo catalogue:", (error as Error).message);
    return readCache();
  }
};

const getCatalog = async () => {
  if (catalogPromise && Date.now() - catalogLoadedAt < REFRESH_MS) {
    return catalogPromise;
  }

  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < REFRESH_MS) {
    catalogLoadedAt = Date.now();
    catalogPromise = Promise.resolve(cached);
  } else {
    catalogPromise = fetchCatalog().then((catalog) => {
      // Even when refresh falls back to an old cache, wait before retrying so
      // a temporary upstream outage does not slow down every playlist refresh.
      catalogLoadedAt = Date.now();
      return catalog;
    });
  }

  return catalogPromise;
};

const preferredLogo = (logos: IptvLogo[]) => {
  const usable = logos
    .filter((logo) => logo.in_use !== false && logo.url)
    .sort((first, second) => {
      const score = (logo: IptvLogo) => {
        const format = logo.format?.toUpperCase();
        if (format === "PNG") return 3;
        if (format === "JPEG" || format === "JPG" || format === "WEBP") return 2;
        return 1;
      };
      return score(second) - score(first);
    });

  return usable[0]?.url;
};

const resolveMatch = (
  name: string,
  channels: IptvChannel[],
  logosByChannel: Map<string, IptvLogo[]>,
): LogoMatch => {
  const exactKey = normalize(name.replace(/\s*\[[^\]]+\]/g, " "));
  const baseKey = normalizedBaseName(name);
  const requestedCountry = countryAliases[countryCodeFromName(name) || ""] || countryCodeFromName(name);

  const candidates = channels.filter((channel) => {
    const names = [channel.name, ...(channel.alt_names || [])];
    return names.some(
      (candidateName) =>
        normalize(candidateName) === exactKey ||
        normalizedBaseName(candidateName) === baseKey,
    );
  });

  const countryCandidates = requestedCountry
    ? candidates.filter((candidate) => candidate.country === requestedCountry)
    : [];
  if (requestedCountry && countryCandidates.length === 0) return {};

  const narrowed = countryCandidates.length > 0 ? countryCandidates : candidates;

  const withLogos = narrowed
    .map((channel) => ({ channel, logo: preferredLogo(logosByChannel.get(channel.id) || []) }))
    .filter((candidate): candidate is { channel: IptvChannel; logo: string } => Boolean(candidate.logo));

  if (withLogos.length === 0) return {};

  let selected = withLogos[0];
  if (countryCandidates.length === 0) {
    const logoCounts = new Map<string, typeof withLogos>();
    for (const candidate of withLogos) {
      const group = logoCounts.get(candidate.logo) || [];
      group.push(candidate);
      logoCounts.set(candidate.logo, group);
    }

    const dominantGroup = [...logoCounts.values()].sort(
      (first, second) => second.length - first.length,
    )[0];
    const secondLargestCount = [...logoCounts.values()]
      .sort((first, second) => second.length - first.length)[1]?.length || 0;

    // If regional entries share a clear majority logo, use it. If the
    // catalogue is evenly split, avoid assigning a potentially wrong logo.
    if (
      dominantGroup &&
      (dominantGroup.length > secondLargestCount || logoCounts.size === 1)
    ) {
      selected = dominantGroup[0];
    } else {
      return {};
    }
  }

  if (!selected) return {};

  const hasConfidentId = countryCandidates.length === 1 || candidates.length === 1;
  return {
    ...(hasConfidentId ? { tvgId: selected.channel.id } : {}),
    logo: selected.logo,
  };
};

const validateLogoUrls = async (urls: string[]) => {
  const pendingUrls = urls.filter(
    (url) => !reachableLogoUrls.has(url) && !unreachableLogoUrls.has(url),
  );

  for (let index = 0; index < pendingUrls.length; index += 10) {
    const batch = pendingUrls.slice(index, index + 10);
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          const response = await axios.get(url, {
            timeout: 10_000,
            responseType: "stream",
            maxContentLength: 2 * 1024 * 1024,
            headers: { "User-Agent": "acestream-middleware/1.0" },
            validateStatus: () => true,
          });
          response.data.destroy();
          return {
            url,
            reachable:
              response.status >= 200 &&
              response.status < 400 &&
              String(response.headers["content-type"] || "").startsWith("image/"),
          };
        } catch {
          return { url, reachable: false };
        }
      }),
    );

    for (const result of results) {
      (result.reachable ? reachableLogoUrls : unreachableLogoUrls).add(result.url);
    }
  }

  return reachableLogoUrls;
};

export const addAutomaticLogos = async (
  channels: Map<string, ChannelSearchResult>,
) => {
  const catalog = await getCatalog();
  if (!catalog) return channels;

  if (validatedCatalogFetchedAt !== catalog.fetchedAt) {
    validatedCatalogFetchedAt = catalog.fetchedAt;
    reachableLogoUrls.clear();
    unreachableLogoUrls.clear();
  }

  const logosByChannel = new Map<string, IptvLogo[]>();
  for (const logo of catalog.logos) {
    const existing = logosByChannel.get(logo.channel) || [];
    existing.push(logo);
    logosByChannel.set(logo.channel, existing);
  }

  const matches = new Map<string, LogoMatch>();
  for (const [key, channel] of channels) {
    matches.set(key, resolveMatch(channel.name, catalog.channels, logosByChannel));
  }

  const logoUrls = [...new Set([...matches.values()].flatMap((match) =>
    match.logo ? [match.logo] : [],
  ))];
  const validLogoUrls = await validateLogoUrls(logoUrls);

  let matched = 0;
  const hydrated = new Map<string, ChannelSearchResult>();
  for (const [key, channel] of channels) {
    const match = matches.get(key);
    const validMatch = match?.logo && validLogoUrls.has(match.logo) ? match : {};
    if (validMatch.logo) matched += 1;
    hydrated.set(key, { ...channel, ...validMatch });
  }

  console.log(`iptv-org: matched logos for ${matched}/${channels.size} channels`);
  return hydrated;
};
