import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { json } from "express";
import cron from "node-cron";
import { DEFAULT_BROWSER_STREAMS } from "./config/browser-streams";
import { generateAndSaveM3U8 } from "./lib/scrape";
import { error_middleware } from "./middleware/error-middleware";
import browserStreamRouter, {
  browserAssetRouter,
} from "./routes/browser-stream-route";
import searchRouter from "./routes/search-routes";
import aceRouter from "./routes/stream-routes";
import fs from "fs";
import path from "path";

const app = express();
app.set("trust proxy", true);
app.set("trust proxy", true);
app.use(cors());
app.use(json());
app.use(cookieParser());

app.use("/ace", aceRouter);
app.use("/search", searchRouter);
app.use("/browser-stream", browserStreamRouter);
app.use("/browser", browserAssetRouter);

app.get(["/live.m3u8", "/live-remote.m3u8"], (req, res, next) => {
  const filename = path.basename(req.path);
  const filePath = path.join(__dirname, "public", filename);

  if (!fs.existsSync(filePath)) {
    next();
    return;
  }

  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");
  const publicOrigin = `${protocol}://${host}`;
  const browserEntries = DEFAULT_BROWSER_STREAMS.map((source) => {
    const name = source.name.replace(/["\r\n]/g, "");
    const category = source.category.replace(/["\r\n]/g, "");
    const sourceUrl = `${publicOrigin}/browser-stream?url=${encodeURIComponent(source.url)}`;
    return `#EXTINF:-1 tvg-name="${name}" tvg-type="live" group-title="${category}",${name}\n${sourceUrl}`;
  }).join("\n");
  const playlist = fs.readFileSync(filePath, "utf8");

  res
    .type("application/vnd.apple.mpegurl")
    .send(`${playlist.trimEnd()}\n${browserEntries}\n`);
});

app.use(express.static(path.join(__dirname, "public")));
app.use(error_middleware);

generateAndSaveM3U8().then(() => {
  cron.schedule("10,25,40,55 * * * *", generateAndSaveM3U8);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 6877;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
