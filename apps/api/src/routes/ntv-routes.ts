import { Request, Response, Router } from "express";
import { axiosBase } from "../lib/axios";

const ntvRouter = Router();

ntvRouter.get("/:asset", async (req: Request, res: Response) => {
  const asset = req.params.asset;
  if (!asset || !/^(?:\d+\.m3u8|ntv-\d+-\d+\.ts)$/.test(asset)) {
    res.status(404).send("Not found");
    return;
  }

  const relayUrl = `http://ntv-relay:8787/ntv/${encodeURIComponent(asset)}`;
  console.log(`[ntv-api] Proxying ${asset} to ntv-relay`);

  try {
    const { data, headers } = await axiosBase.get(relayUrl, {
      responseType: "stream",
      timeout: 70_000,
    });

    res.setHeader(
      "Content-Type",
      headers["content-type"] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Access-Control-Allow-Origin", "*");

    req.on("close", () => data.destroy());
    data.pipe(res);
  } catch (error) {
    console.error(`[ntv-api] Relay request failed for ${asset}:`, error);
    res.status(502).send("NTV relay unavailable");
  }
});

export default ntvRouter;
