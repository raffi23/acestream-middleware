"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/app/_components/spinner";

type Props = {
  data: { label: string; value: string }[];
  value?: string;
  onChange?: (value: string) => void;
  searchText?: string;
  onSearchTextChange?: (value: string) => void;
  isLoading?: boolean;
};
export const Combobox: React.FC<Props> = ({
  data,
  value,
  onChange,
  searchText,
  onSearchTextChange,
  isLoading,
}) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex-1 justify-between"
        >
          <span>{searchText || "Search channel..."}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command value={value} shouldFilter={false}>
          <CommandInput
            value={searchText}
            onValueChange={onSearchTextChange}
            placeholder="Channel name..."
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>No channels found.</CommandEmpty>
            <CommandGroup>
              {isLoading && (
                <CommandItem className="justify-center">
                  <Spinner />
                </CommandItem>
              )}

              {!isLoading &&
                data.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    onSelect={(currentValue) => {
                      onChange?.(currentValue);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                    <Check
                      className={cn(
                        "ml-auto",
                        value === item.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
