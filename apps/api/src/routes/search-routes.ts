import * as cheerio from "cheerio";
import { Request, Response, Router } from "express";
import { axiosBase } from "../lib/axios";
import { Channel } from "../types";

const searchRouter = Router();

searchRouter.get("/", async (req: Request, res: Response) => {
  const query = req.query.query;
  const queryData = new URLSearchParams({
    method: "search",
    ...(typeof query === "string" && { q: query }),
  });
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

  res
    .status(200)
    .send(extracted.streams as Pick<Channel, "name" | "infohash">[]);
});

export default searchRouter;
