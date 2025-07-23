import cookieParser from "cookie-parser";
import cors from "cors";
import express, { json } from "express";
import aceRouter from "./routes/stream-routes";
import searchRouter from "./routes/search-routes";
import { error_middleware } from "./middleware/error-middleware";

const app = express();
app.use(cors());
app.use(json());
app.use(cookieParser());

app.use("/ace", aceRouter);
app.use("/search", searchRouter);

app.use(error_middleware);

const PORT = process.env.PORT ? Number(process.env.PORT) : 6877;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
