import { Request, Response, Router } from "express";
import axios from "../lib/axios";

const aceRouter = Router();

aceRouter.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  const consutructUrl = `/ace/getstream?id=${id}`;

  const { data, headers } = await axios.get(consutructUrl, {
    responseType: "stream",
  });

  res.setHeader("Content-Type", headers["content-type"] || "video/mp4");
  if (headers["content-length"]) {
    res.setHeader("Content-Length", headers["content-length"]);
  }

  req.on("close", () => data.destroy());
  data.pipe(res);
});

export default aceRouter;
