"use client";

import { Button } from "@/components/ui/button";
import { useQueryFilter } from "@/hooks/useQueryFilter";
import { FC } from "react";

type QueryFilters = {
  local?: string;
};

const LocalSwitchButton: FC = () => {
  const {
    filter: { local },
    setFilter,
  } = useQueryFilter<QueryFilters>({ local: "true" });
  const isLocalSearch = local === "true";

  return (
    <Button
      variant="link"
      onClick={() => {
        setFilter({ local: isLocalSearch ? "false" : "true" });
      }}
    >
      {!isLocalSearch ? "Switch to local search" : "Switch to server search"}
    </Button>
  );
};

export default LocalSwitchButton;
