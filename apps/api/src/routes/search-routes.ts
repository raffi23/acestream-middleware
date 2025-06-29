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
  const { data } = await axiosBase.get(
    "https://search.acestream.net/all?api_version=1&api_key=test_api_key"
  );

  res.status(200).send(
    data.sort((a: Channel, b: Channel) => {
      const channelA = firstValidCategory(a.categories);
      const channelB = firstValidCategory(b.categories);

      const aIs18 = is18Plus(a);
      const bIs18 = is18Plus(b);

      if (aIs18 && bIs18) return 0;
      if (aIs18) return 1;
      if (bIs18) return -1;

      if (!channelA && !channelB) return 0;
      if (!channelA) return 1;
      if (!channelB) return -1;

      return channelA.localeCompare(channelB);
    })
  );
});

export default searchRouter;
