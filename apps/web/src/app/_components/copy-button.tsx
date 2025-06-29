"use client";

import { Slot } from "@radix-ui/react-slot";
import { FC, PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
  data: string;
  onCopied?: () => void;
}

const CopyButton: FC<Props> = ({ data, children, onCopied }) => {
  const copyLinkHandler = () => {
    navigator.clipboard.writeText(data).then(() => {
      onCopied?.();
    });
  };

  return <Slot onClick={copyLinkHandler}>{children}</Slot>;
};

export default CopyButton;
