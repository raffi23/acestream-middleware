"use client";

import { Input } from "@/components/ui/input";
import { useQueryFilter } from "@/hooks/useQueryFilter";
import { FC } from "react";

type QueryFilters = {
  query?: string;
};

const AppSearch: FC = () => {
  const { filter, setFilter } = useQueryFilter<QueryFilters>({ query: "" });

  return (
    <Input
      placeholder="Search channels..."
      value={filter.query}
      onChange={(e) => setFilter({ query: e.target.value })}
    />
  );
};

export default AppSearch;
