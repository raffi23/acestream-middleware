import { Button } from "@/components/ui/button";
import { ChannelSearchItem } from "@/types";
import { FC } from "react";
import CopyButton from "./copy-button";

type Props = {
  channel: ChannelSearchItem;
  onCopied?: () => void;
};

const ChNameCopyButton: FC<Props> = ({ channel, onCopied }) => {
  return (
    <CopyButton data={channel.name} onCopied={onCopied}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start"
      >
        {channel.name}
      </Button>
    </CopyButton>
  );
};

export default ChNameCopyButton;
