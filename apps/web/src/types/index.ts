export type Nullable<T> = T | null | undefined;

export type PropsWithParams<T = unknown> = T & {
  params: Promise<Record<string, Nullable<string>>>;
  searchParams: Promise<Record<string, Nullable<string>>>;
};

export type Channel = {
  infohash: string;
  name: string;
  availability: number;
  availability_updated_at: number;
  categories: string[];
};

export type ChannelSearchItem = Pick<Channel, "name" | "infohash">;

export type StreamGroup = { category: string; channels: Channel[] | undefined };
