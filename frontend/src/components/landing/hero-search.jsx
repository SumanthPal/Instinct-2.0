"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FiSearch } from "react-icons/fi";

export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/clubs?search=${encodeURIComponent(term)}` : "/clubs");
  };

  return (
    <form onSubmit={onSubmit} className="mt-10 flex max-w-lg gap-2">
      <div className="relative flex-1">
        <FiSearch
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clubs, e.g. robotics"
          aria-label="Search clubs"
          className="h-11 rounded-lg border-border bg-card pl-10 text-base shadow-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <Button type="submit" className="instinct-btn h-11 rounded-full px-5 text-white">
        Search
      </Button>
    </form>
  );
}
