import ChannelItem from "@/components/channel-item";
import { queryStream } from "@/lib/api";
import { PropsWithParams } from "@/types";
import AppSearch from "./_components/app-search";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LocalSwitchButton from "./_components/local-switch-button";

export default async function Home({ searchParams }: PropsWithParams) {
  const { query = "", local = "true" } = await searchParams;
  const isLocalSearch = local === "true";
  const data = query
    ? await queryStream(query).catch((error) => {
        console.log("Error fetching channels:", error.message);

        return [];
      })
    : [];

  return (
    <div className="flex flex-col gap-4">
      <AppSearch />

      {data.length > 0 && (
        <div className="p-2 flex flex-col gap-2">
          {data.map((channel, index) => (
            <ChannelItem
              key={`${channel.infohash}-${index}`}
              channel={channel}
              isLocal={isLocalSearch}
            />
          ))}
        </div>
      )}

      <div className="flex justify-center items-center gap-2">
        <LocalSwitchButton />

        <Button asChild variant="link">
          <Link href="/generate">Generate a link instead</Link>
        </Button>
      </div>
    </div>
  );
}
