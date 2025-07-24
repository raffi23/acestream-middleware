import LocalSwitchButton from "@/app/_components/local-switch-button";
import ChannelItem from "@/components/channel-item";
import { PropsWithParams } from "@/types";
import { redirect } from "next/navigation";
import { FC } from "react";

const Page: FC<PropsWithParams> = async ({ params, searchParams }) => {
  const { id } = await params;
  if (!id) redirect("/generate");
  const { local = "false" } = await searchParams;
  const isLocal = local === "true";

  return (
    <div className="flex flex-col gap-4">
      <ChannelItem
        channel={{ infohash: id, name: "Generated channel" }}
        isLocal={isLocal}
      />

      <LocalSwitchButton />
    </div>
  );
};

export default Page;
