import base from "axios";

const axios = base.create({
  baseURL: process.env.NEXT_PUBLIC_BE_URL,
  headers: {
    "P-Access-Token": process.env.NEXT_PUBLIC_ACCESS_TOKEN,
    "P-Access-Token-Id": process.env.NEXT_PUBLIC_ACCESS_TOKEN_ID,
  },
});

export { base as axiosBase };

export default axios;
