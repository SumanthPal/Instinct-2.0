"use client";
import SearchBar from "./ui/SearchBar";
import { useToast } from "@/components/ui/toast";

export default function SearchSection({
  searchInput,
  onSearchChange,
  onSearch,
  user,
}) {
  const { toast } = useToast();

  const handleSearch = () => {
    if (searchInput.trim() !== "") {
      if (!user) {
        toast({
          title: "Authentication Required",
          description:
            "Sign in to use hybrid search capabilities for better results",
          status: "info",
          duration: 5000,
          isClosable: true,
        });
      }
      onSearch();
    }
  };

  return (
    <div className="relative mx-auto mb-8 max-w-2xl">
      <div className="rounded-full border border-border bg-card/80 p-1 shadow-sm backdrop-blur-sm">
        <SearchBar
          value={searchInput}
          onChange={onSearchChange}
          onEnter={handleSearch}
          placeholder="Search clubs..."
          className="w-full rounded-full bg-transparent px-4 py-2.5 text-sm text-foreground outline-hidden placeholder:text-muted-foreground sm:px-5 sm:py-3 sm:text-base"
        />
      </div>
    </div>
  );
}
