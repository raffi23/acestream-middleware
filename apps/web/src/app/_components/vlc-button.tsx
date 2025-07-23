import { Button } from "@/components/ui/button";
import { generateVLCLink } from "@/lib/utils";
import Link from "next/link";
import { FC } from "react";

type Props = {
  infohash: string;
};
const VLCButton: FC<Props> = ({ infohash }) => {
  const link = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(
    generateVLCLink(infohash)
  )}`;

  return (
    <Button variant="vlc" className="font-semibold" asChild>
      <Link href={link} target="_blank" rel="noopener noreferrer">
        VLC
      </Link>
    </Button>
  );
};

export default VLCButton;
