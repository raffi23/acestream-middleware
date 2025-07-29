import base from "axios";

const axios = base.create({
  baseURL: process.env.ACE_URL,
  timeout: 12000,
  signal: AbortSignal.timeout(12000),
});

const axiosBase = base.create({
  timeout: 12000,
  signal: AbortSignal.timeout(12000),
});

export { axiosBase };

export default axios;
