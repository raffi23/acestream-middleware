import { PropsWithParams } from "@/types";
import AppSearch from "./_components/app-search";
import { queryStream } from "@/lib/api";
import ChNameCopyButton from "./_components/channel-button";

export default async function Home({ searchParams }: PropsWithParams) {
  const { query } = await searchParams;
  const data = query ? await queryStream(query, true).catch(() => []) : [];

  return (
    <div className="max-w-lg mx-auto mt-[calc(30vh_-_3.3125rem)] bg-sidebar rounded-lg p-4">
      <AppSearch />

      {data.length > 0 && (
        <div className="p-2 flex flex-col gap-2">
          {data.map((channel) => (
            <ChNameCopyButton key={channel.infohash} channel={channel} />
          ))}
        </div>
      )}
    </div>
  );
}
