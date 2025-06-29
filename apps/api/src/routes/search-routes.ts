import { Request, Response, Router } from "express";
import axios, { axiosBase } from "../lib/axios";
import { Channel } from "../types";

const searchRouter = Router();
const is18Plus = (channel: Channel) => {
  return (
    (channel.name && channel.name.includes("18+")) ||
    (channel.categories &&
      (channel.categories.includes("18+") ||
        channel.categories.includes("erotic_18_plus")))
  );
};

const firstValidCategory = (categories: string[]) => {
  if (!categories || categories.length === 0) return null;
  return categories.find((cat) => cat && cat.trim() !== "") || null;
};

searchRouter.get("/", async (req: Request, res: Response) => {
  const query = req.query.query;
  const queryData = new URLSearchParams({
    method: "search",
    ...(typeof query === "string" && { query }),
  });
  const consutructUrl = `/server/api?${queryData}`;
  const { data } = await axios.get(consutructUrl);

  res.status(200).send(data);
});

searchRouter.get("/all", async (req: Request, res: Response) => {
  const { data } = await axiosBase.get<Channel[]>(
    "https://search.acestream.net/all?api_version=1&api_key=test_api_key"
  );

  const grouped: Record<string, Channel[]> = {};

  for (const channel of data) {
    if (is18Plus(channel)) {
      (grouped["18+"] ||= []).push(channel);
      continue;
    }

    const category =
      firstValidCategory(channel.categories)?.toLowerCase() || "uncategorized";
    (grouped[category] ||= []).push(channel);
  }

  const sortedGroups = Object.keys(grouped)
    .sort((a, b) => {
      if (a === "uncategorized" || a === "18+") return 1;
      if (b === "uncategorized" || b === "18+") return -1;
      return a.localeCompare(b);
    })
    .map((cat) => ({ category: cat, channels: grouped[cat] }));

  res.status(200).send(sortedGroups);
});

export default searchRouter;
