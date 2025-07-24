"use client";

import { Input } from "@/components/ui/input";
import { useQueryFilter } from "@/hooks/useQueryFilter";
import { FC } from "react";

type QueryFilters = {
  query?: string;
};

const AppSearch: FC = () => {
  const {
    filter: { query },
    setFilter,
  } = useQueryFilter<QueryFilters>({ query: "" });

  return (
    <Input
      placeholder="Search channels..."
      value={query}
      onChange={(e) =>
        setFilter({
          query: {
            value: e.target.value,
            canUpdate: e.target.value.length > 2,
          },
        })
      }
    />
  );
};

export default AppSearch;
