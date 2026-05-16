import axios, { AxiosError } from "axios";
import { ChannelSearchResult } from "../types";

const SEARCH_API = "https://search-ace.stream/search";

type SearchApiResult = {
  content_id: string;
  name: string;
  pid: number;
  translated_name: string;
};

export const searchAceChannels = async (
  query: string,
): Promise<Pick<ChannelSearchResult, "name" | "infohash">[]> => {
  try {
    const { data } = await axios.get<SearchApiResult[]>(SEARCH_API, {
      params: { query },
      timeout: 15_000,
    });

    return data
      .filter((result) => result.content_id && result.name)
      .map((result) => ({ name: result.name, infohash: result.content_id }));
  } catch (error) {
    console.error(
      `Search failed for "${query}":`,
      (error as AxiosError)?.message,
    );
    return [];
  }
};
