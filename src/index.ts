import dotenv from "dotenv";
dotenv.config();

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { json } from "express";
import aceRouter from "./routes/ace-routes";

const app = express();
app.use(cors());
app.use(json());
app.use(cookieParser());

app.use("/stream", aceRouter);

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || "localhost";

app.listen(PORT, HOST, () => {
  console.log("server is running");
});
