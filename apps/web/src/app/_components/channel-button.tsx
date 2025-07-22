import { Button } from "@/components/ui/button";
import { generateVLCLink } from "@/lib/utils";
import { ChannelSearchItem } from "@/types";
import { FC } from "react";
import CopyButton from "./copy-button";
import { CopyIcon } from "lucide-react";

type Props = {
  channel: ChannelSearchItem;
};

const ChannelCopyButton: FC<Props> = ({ channel }) => {
  const link = generateVLCLink(channel.infohash);

  return (
    <CopyButton data={link}>
      <Button type="button" variant="default" size="icon">
        <CopyIcon />
      </Button>
    </CopyButton>
  );
};

export default ChannelCopyButton;
