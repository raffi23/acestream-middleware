import { Request, Response, Router } from "express";
import axios from "../lib/axios";
import { Channel } from "../types";

const searchRouter = Router();

searchRouter.get("/", async (req: Request, res: Response) => {
  const query = req.query.query;
  const queryData = new URLSearchParams({
    method: "search",
    ...(typeof query === "string" && { query }),
  });
  const consutructUrl = `/server/api?${queryData}`;
  const { data } = await axios.get(consutructUrl);
  const result = (data.result?.results ?? []) as { items: Channel[] }[];
  const formattedData = result.flatMap((item) => item.items);
  res.status(200).send(formattedData);
});

export default searchRouter;
