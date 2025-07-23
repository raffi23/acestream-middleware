"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useState } from "react";

const GenerateRedirectButton = () => {
  const [input, setInput] = useState("");

  return (
    <div className="flex flex-col items-center gap-4">
      <Input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter something..."
      />

      <Button asChild>
        <Link
          href={`/generate/${input.replace("acestream://", "")}`}
          className="w-full"
        >
          Generate Link
        </Link>
      </Button>
    </div>
  );
};

export default GenerateRedirectButton;
