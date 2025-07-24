import { Button } from "@/components/ui/button";
import { generateVLCLink } from "@/lib/utils";
import { ChannelSearchItem } from "@/types";
import { FC } from "react";
import CopyButton from "./copy-button";
import { CopyIcon } from "lucide-react";

type Props = {
  channel: ChannelSearchItem;
  isLocal: boolean;
};

const ChannelCopyButton: FC<Props> = ({ channel, isLocal }) => {
  const link = generateVLCLink(channel.infohash, isLocal);

  return (
    <CopyButton data={link}>
      <Button type="button" variant="default" size="icon">
        <CopyIcon />
      </Button>
    </CopyButton>
  );
};

export default ChannelCopyButton;
