import { Request, Response, Router } from "express";
import axios from "../lib/axios";

const aceRouter = Router();

aceRouter.get("/http/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  const consutructUrl = `/ace/getstream?id=${id}`;

  const { data, headers } = await axios.get(consutructUrl, {
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
});

// aceRouter.get("/hls/:id", async (req: Request, res: Response) => {
//   const id = req.params.id;
//   const consutructUrl = `/ace/manifest.m3u8?id=${id}`;
//   const { data } = await axios.get(consutructUrl);
//   const playlist = (data as string).replaceAll(
//     process.env.ACESTREAM_URL || "http://localhost:6878",
//     process.env.REDIRECT_URL || "http://localhost:6878"
//   );

//   res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
//   res.setHeader("Content-Disposition", `attachment; filename="${id}.m3u8"`);

//   res.status(200).send(playlist);
// });

export default aceRouter;
