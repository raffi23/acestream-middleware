import ChannelItem from "@/components/channel-item";
import { PropsWithParams } from "@/types";
import { redirect } from "next/navigation";
import { FC } from "react";

const Page: FC<PropsWithParams> = async ({ params }) => {
  const { id } = await params;
  if (!id) redirect("/generate");

  return <ChannelItem channel={{ infohash: id, name: "Generated channel" }} />;
};

export default Page;
