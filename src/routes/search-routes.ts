import { Request, Response, Router } from "express";
import axios, { axiosBase } from "../lib/axios";

const searchRouter = Router();

searchRouter.get("/", async (req: Request, res: Response) => {
  const query = req.query.query;
  const queryData = new URLSearchParams({
    method: "search",
    ...(typeof query === "string" && { query }),
  });
  const consutructUrl = `/server/api?${queryData}`;
  const { data } = await axios.get(consutructUrl);

  res.status(200).send(data);
});

searchRouter.get("/all", async (req: Request, res: Response) => {
  const { data } = await axiosBase.get(
    "https://search.acestream.net/all?api_version=1&api_key=test_api_key"
  );

  res.status(200).send(
    data.sort((a: any, b: any) => {
      const catA = a.categories[0] || "";
      const catB = b.categories[0] || "";
      return catA.localeCompare(catB);
    })
  );
});

export default searchRouter;
