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

app.use("/ace", aceRouter);

app.listen(4000, "0.0.0.0", () => {
  console.log("server is running");
});
