import { Request, Response, Router } from "express";
import { axiosBase } from "../lib/axios";

const browserStreamRouter = Router();
const relayBaseUrl = "http://browser-relay:8787";

browserStreamRouter.get("/", async (req: Request, res: Response) => {
  const pageUrl = req.query.url;
  if (typeof pageUrl !== "string" || !pageUrl) {
    res.status(400).json({ error: "url query parameter is required" });
    return;
  }

  const { data } = await axiosBase.post(
    `${relayBaseUrl}/sessions`,
    { url: pageUrl },
    { timeout: 10_000 },
  );
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");
  res.redirect(`${protocol}://${host}/browser/${data.id}.m3u8`);
});

export const browserAssetRouter = Router();

browserAssetRouter.get("/:asset", async (req: Request, res: Response) => {
  const asset = req.params.asset;
  if (!asset || !/^(?:[a-f0-9-]+\.m3u8|browser-[a-f0-9-]+-\d+\.ts)$/i.test(asset)) {
    res.status(404).send("Not found");
    return;
  }

  const { data, headers } = await axiosBase.get(
    `${relayBaseUrl}/browser/${encodeURIComponent(asset)}`,
    { responseType: "stream", timeout: 70_000 },
  );
  res.setHeader("Content-Type", headers["content-type"] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  req.on("close", () => data.destroy());
  data.pipe(res);
});

export default browserStreamRouter;
