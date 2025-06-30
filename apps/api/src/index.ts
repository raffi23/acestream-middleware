import dotenv from "dotenv";
dotenv.config();

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { json } from "express";
import aceRouter from "./routes/stream-routes";
import searchRouter from "./routes/search-routes";
import { error_middleware } from "./middleware/error-middleware";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(json());
app.use(cookieParser());

app.use("/stream", aceRouter);
app.use("/search", searchRouter);

app.use(error_middleware);

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "localhost";

app.listen(PORT, HOST, () => {
  console.log(`server is running on ${HOST}:${PORT}`);
});
