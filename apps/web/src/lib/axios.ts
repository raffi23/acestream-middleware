import base from "axios";

export const axiosAcelink = base.create({
  baseURL: "http://acelink:6878",
});

export const axiosAPI = base.create({
  baseURL: "http://acelink-api:4000",
});

export const axiosClient = base.create({
  baseURL: process.env.NEXT_PUBLIC_BE_URL,
});

export { base as axiosBase };
