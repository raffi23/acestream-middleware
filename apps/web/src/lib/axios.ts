import base from "axios";

const axios = base.create({
  baseURL: process.env.NEXT_PUBLIC_BE_URL,
  withCredentials: true,
});

export { base as axiosBase };

export default axios;
