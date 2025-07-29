import * as cheerio from "cheerio";
import { axiosBase } from "./axios";

export const searchChannels = async (query: string) => {
  const queryData = new URLSearchParams({
    ...(typeof query === "string" && { q: query }),
  });
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const consutructUrl = `https://www.acestreamsearch.net/en/?${queryData}`;
  const { data } = await axiosBase.get(consutructUrl, {
    headers: {
      Accept: "text/html",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36",
    },
    responseType: "text",
  });

  const $ = cheerio.load(data);
  const extracted = $(".list-group-item").extract({
    streams: [
      {
        selector: ".list-group-item a",
        value: (el) => {
          const name = $(el).text();
          const infohash = $(el).attr("href")?.replace("acestream://", "");
          return { name, infohash };
        },
      },
    ],
  });
  return extracted.streams;
};
