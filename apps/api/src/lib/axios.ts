import base from "axios";

const axios = base.create({
  baseURL: process.env.ACE_URL,
});

export { base as axiosBase };

export default axios;
