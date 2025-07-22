import base from "axios";

export const axios = base.create({
  baseURL: process.env.NEXT_PUBLIC_BE_URL,
});
