import { Request, Response, Router } from "express";
import axios from "../lib/axios";

const aceRouter = Router();

const runStream = async (url: string, req: Request, res: Response) => {
  const { data, headers } = await axios.get(url, {
    responseType: "stream",
  });

  req.on("close", () => {
    data.destroy();
  });

  res.setHeader("Content-Type", headers["content-type"] || "video/mp4");
  if (headers["content-length"]) {
    res.setHeader("Content-Length", headers["content-length"]);
  }

  data.pipe(res);
};

aceRouter.get("/stream/:id", async (req, res) => {
  const id = req.params.id;
  const consutructUrl = `/getstream?id=${id}`;
  await runStream(consutructUrl, req, res);
});

export default aceRouter;
