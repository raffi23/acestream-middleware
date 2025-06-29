import { Channel, StreamGroup } from "@/types";
import axios from "./axios";

export const queryStream = async (query: string) => {
  return axios
    .get<Channel[]>(`/search?${new URLSearchParams({ query })}`)
    .then((res) => res.data);
};

export const getAllStreamGroups = async () => {
  return axios.get<StreamGroup[]>("/search/all").then((res) => res.data);
};
