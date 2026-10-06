"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      <Input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search clubs, e.g. robotics"
        aria-label="Search clubs"
        className="h-11 rounded-md border-border bg-card text-base shadow-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <Button type="submit" className="instinct-btn h-11 rounded-md px-5 text-white">
        Search
      </Button>
    </form>
  );
}
