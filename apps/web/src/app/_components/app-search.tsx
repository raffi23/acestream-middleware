"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useDebounce from "@/hooks/useDebounce";
import { queryStream } from "@/lib/api";
import { generateVLCLink } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { Spinner } from "./spinner";

const AppSearch = () => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { data, mutate, isPending, reset } = useMutation({
    mutationFn: queryStream,
  });

  const hasData = (data?.length ?? 0) > 0;

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
  const copyLinkHandler = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setOpen(false);
    });
  };

  useEffect(() => {
    if (!isPending) setIsLoading(false);
  }, [isPending]);

  return (
    <div className="w-full relative">
      <Input
        placeholder="search channels"
        className="bg-teal-50"
        value={searchText}
        onFocus={() => setOpen(true)}
        // onBlur={() => setOpen(false)}
        onChange={(e) => changeHandler(e.target.value)}
      />

      {(isLoading || (hasData && open)) && (
        <div
          className={clsx(
            "flex flex-col gap-2 absolute top-[calc(100%_+_0.5rem)] rounded-md left-0 right-0 bg-sidebar border p-2",
            isPending ? "items-center" : "items-start"
          )}
        >
          {isLoading ? (
            <Spinner className="mx-auto" />
          ) : (
            data?.map((channel) => (
              <Button
                key={channel.infohash}
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() =>
                  copyLinkHandler(generateVLCLink(channel.infohash))
                }
              >
                {channel.name}
              </Button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AppSearch;
