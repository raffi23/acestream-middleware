import cookieParser from "cookie-parser";
import cors from "cors";
import express, { json } from "express";
import cron from "node-cron";
import {
  generateAndSaveM3U8,
  scrapeChannels,
  scrapeLivetvsx,
} from "./lib/scrape";
import { error_middleware } from "./middleware/error-middleware";
import searchRouter from "./routes/search-routes";
import aceRouter from "./routes/stream-routes";
import path from "path";

const app = express();
app.use(cors());
app.use(json());
app.use(cookieParser());

app.use("/ace", aceRouter);
app.use("/search", searchRouter);

app.use(express.static(path.join(__dirname, "public")));
app.use(error_middleware);

cron.schedule("*/30 * * * *", async () => {
  await generateAndSaveM3U8();
});

generateAndSaveM3U8();

const PORT = process.env.PORT ? Number(process.env.PORT) : 6877;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
