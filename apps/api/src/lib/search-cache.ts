import fs from "fs";
import path from "path";
import { ChannelSearchResult } from "../types";

const SEARCH_CACHE_FILE =
  process.env.SEARCH_ACE_CACHE_FILE ||
  path.join(__dirname, "../public/search-ace-cache.json");

const isSearchResult = (value: unknown): value is ChannelSearchResult => {
  if (!value || typeof value !== "object") return false;

  const result = value as Partial<ChannelSearchResult>;
  return (
    typeof result.infohash === "string" &&
    result.infohash.length > 0 &&
    typeof result.name === "string" &&
    result.name.length > 0 &&
    (result.category === undefined || typeof result.category === "string")
  );
};

export const loadSearchAceCache = () => {
  try {
    const contents = fs.readFileSync(SEARCH_CACHE_FILE, "utf8");
    const parsed: unknown = JSON.parse(contents);

    if (!Array.isArray(parsed)) {
      console.warn(`Search-Ace cache is not an array: ${SEARCH_CACHE_FILE}`);
      return new Map<string, ChannelSearchResult>();
    }

    return new Map(
      parsed
        .filter(isSearchResult)
        .map((result) => [result.infohash, result] as const),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(
        `Could not load Search-Ace cache from ${SEARCH_CACHE_FILE}:`,
        (error as Error).message,
      );
    }

    return new Map<string, ChannelSearchResult>();
  }
};

export const saveSearchAceCache = (
  cache: Map<string, ChannelSearchResult>,
) => {
  const directory = path.dirname(SEARCH_CACHE_FILE);
  const temporaryFile = `${SEARCH_CACHE_FILE}.${process.pid}.tmp`;

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      temporaryFile,
      `${JSON.stringify([...cache.values()], null, 2)}\n`,
      "utf8",
    );
    fs.renameSync(temporaryFile, SEARCH_CACHE_FILE);
  } catch (error) {
    console.warn(
      `Could not save Search-Ace cache to ${SEARCH_CACHE_FILE}:`,
      (error as Error).message,
    );

    try {
      fs.rmSync(temporaryFile, { force: true });
    } catch {
      // Preserve the original cache error; cleanup is best effort.
    }
  }
};
