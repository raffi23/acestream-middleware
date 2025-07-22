import { ChannelSearchItem } from "@/types";
import { axios } from "./axios";

export const queryStream = async (query: string) => {
  return axios
    .get<ChannelSearchItem[]>(`/search?${new URLSearchParams({ query })}`)
    .then((res) => res.data);
};
