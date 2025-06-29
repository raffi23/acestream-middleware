export type Channel = {
  infohash: string;
  name: string;
  availability: number;
  availability_updated_at: number;
  categories: string[];
};

export type StreamGroup = { category: string; channels: Channel[] | undefined };
