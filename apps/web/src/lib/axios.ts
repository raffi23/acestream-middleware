import base from "axios";

const axios = base.create({
  baseURL: process.env.NEXT_PUBLIC_BE_URL,
});

export const serverAxios = base.create({
  baseURL: process.env.NEXT_PUBLIC_BE_SERVER_URL,
});

export { base as axiosBase };

export default axios;
