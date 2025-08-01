export type Channel = {
  infohash: string;
  name: string;
  availability: number;
  availability_updated_at: number;
  categories: string[];
};

export type ChannelSearchResult = {
  name: string;
  infohash: string | undefined;
};
