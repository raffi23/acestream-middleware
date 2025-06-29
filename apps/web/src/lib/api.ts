import axios from "./axios";

export const searchStream = async (query: string) => {
  return axios
    .get(`/search?${new URLSearchParams({ query })}`)
    .then((res) => res.data);
};

export const getAllStreams = async () => {
  return axios.get("/search/all").then((res) => res.data);
};
