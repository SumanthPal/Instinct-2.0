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
    <div className="relative w-full sm:max-w-xs">
      <SearchBar
        value={searchInput}
        onChange={onSearchChange}
        onEnter={handleSearch}
        placeholder="Search clubs…"
      />
    </div>
  );
}
