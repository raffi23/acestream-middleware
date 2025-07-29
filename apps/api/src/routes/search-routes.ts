import { Request, Response, Router } from "express";
import { searchChannels } from "../lib/search";
import { Channel } from "../types";

const searchRouter = Router();

searchRouter.get("/", async (req: Request, res: Response) => {
  const query = req.query.query;
  const streams = await searchChannels(query as string);

  res.status(200).send(streams as Pick<Channel, "name" | "infohash">[]);
});

export default searchRouter;
