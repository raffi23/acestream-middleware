import base from "axios";

export const axios = base.create({
  baseURL: process.env.BACKEND_URL,
});
