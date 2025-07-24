import ChannelCopyButton from "@/app/_components/channel-button";
import VLCButton from "@/app/_components/vlc-button";
import { ChannelSearchItem } from "@/types";
import { FC } from "react";

type Props = {
  channel: ChannelSearchItem;
  isLocal: boolean;
};

const ChannelItem: FC<Props> = ({ channel, isLocal }) => {
  return (
    <div
      key={channel.infohash}
      className="flex items-center justify-between gap-4 bg-accent p-2 px-4 rounded-lg"
    >
      <p>{channel.name}</p>

      <div className="flex items-center gap-2">
        <ChannelCopyButton channel={channel} isLocal={isLocal} />
        <VLCButton infohash={channel.infohash} isLocal={isLocal} />
      </div>
    </div>
  );
};

export default ChannelItem;
