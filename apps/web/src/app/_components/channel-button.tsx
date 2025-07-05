"use client";

import { Button } from "@/components/ui/button";
import { ChannelSearchItem } from "@/types";
import CopyButton from "./copy-button";
import { FC, useEffect, useState } from "react";
import { generateVLCLink } from "@/lib/utils";

type Props = {
  channel: ChannelSearchItem;
  onCopied?: () => void;
};

const ChannelCopyButton: FC<Props> = ({ channel, onCopied }) => {
  const [link, setLink] = useState("");

  useEffect(() => {
    setLink(generateVLCLink(channel.infohash));
  }, [channel.infohash]);

  return (
    <CopyButton data={link} onCopied={onCopied}>
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

export default ChannelCopyButton;
