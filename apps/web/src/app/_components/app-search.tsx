"use client";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import useDebounce from "@/hooks/useDebounce";
import { queryStream } from "@/lib/api";
import { generateVLCLink } from "@/lib/utils";
import { useStore } from "@/store";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const AppSearch = () => {
  const [value, setValue] = useState("");
  const searchParams = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get("query") ?? "");
  const accessToken = useStore((state) => state.access_token);
  const setAccessToken = useStore((state) => state.setAccessToken);
  const [isLoading, setIsLoading] = useState(false);

  const {
    data = [],
    mutate,
    isPending,
    reset,
  } = useMutation({
    mutationFn: queryStream,
  });
  const formattedData = useMemo(
    () =>
      data.map((channel) => ({
        label: channel.name,
        value: channel.infohash,
      })),
    [data]
  );

  const selectedChannel = data.find((c) => c.infohash === value);

  console.log(selectedChannel);

  const debounceSearch = useDebounce(mutate, 500);
  const changeHandler = (text: string) => {
    setSearchText(text);
    if (!text) {
      reset();
    } else {
      setIsLoading(true);
      debounceSearch(text);
    }
  };
  const copyLinkHandler = (infohash: string) => {
    setValue(infohash);
    navigator.clipboard.writeText(generateVLCLink(infohash)).catch(console.log);
  };

  useEffect(() => {
    if (!isPending) setIsLoading(false);
  }, [isPending]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="enter pangolin access token"
        value={accessToken}
        onChange={(e) => setAccessToken(e.target.value)}
      />

      <div className="flex gap-4">
        <Combobox
          data={formattedData}
          value={value}
          isLoading={isLoading}
          onChange={copyLinkHandler}
          searchText={searchText}
          onSearchTextChange={changeHandler}
        />
        <Button asChild>
          <Link href={`/?query=${searchText}`}>Search</Link>
        </Button>

        {selectedChannel && (
          <Button asChild>
            <Link
              href={`vlc-x-callback://x-callback-url/stream?url=${generateVLCLink(
                selectedChannel.infohash
              )}`}
            >
              Open in VLC
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default AppSearch;
