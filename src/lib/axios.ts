import base from "axios";

const axios = base.create({
  baseURL: process.env.AXIOS_BASE_URL,
});

export default axios;
