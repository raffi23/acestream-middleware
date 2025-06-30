import base from "axios";

const axios = base.create({
  baseURL: process.env.NEXT_PUBLIC_BE_URL,
  withCredentials: true,
});

const server = base.create({
  baseURL: "http://acelink-api:4000",
});

export { server as axiosServer };
export { base as axiosBase };

export default axios;
