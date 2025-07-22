import { queryStream } from "@/lib/api";
import { PropsWithParams } from "@/types";
import AppSearch from "./_components/app-search";
import ChannelCopyButton from "./_components/channel-button";
import VLCButton from "./_components/vlc-button";

export default async function Home({ searchParams }: PropsWithParams) {
  const { query } = await searchParams;
  const data = query
    ? await queryStream(query).catch((error) => {
        console.log("Error fetching channels:", error.message);

        return [];
      })
    : [];

  return (
    <div className="max-w-lg mx-auto mt-[calc(30vh_-_3.3125rem)] bg-sidebar rounded-lg p-4">
      <AppSearch />

      {data.length > 0 && (
        <div className="p-2 flex flex-col gap-2">
          {data.map((channel) => (
            <div
              key={channel.infohash}
              className="flex items-center justify-between gap-4"
            >
              <p>{channel.name}</p>

              <div className="flex items-center gap-2">
                <ChannelCopyButton channel={channel} />
                <VLCButton infohash={channel.infohash} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
