import base from "axios";

const axios = base.create({
  baseURL: process.env.NEXT_PUBLIC_BE_URL,
});

export { base as axiosBase };

export default axios;
