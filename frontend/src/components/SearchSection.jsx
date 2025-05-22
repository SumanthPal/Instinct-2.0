"use client";
import SearchBar from "./ui/SearchBar";
import { useToast } from "@/components/ui/toast";

export default function SearchSection({ 
  searchInput, 
  onSearchChange, 
  onSearch, 
  user 
}) {
  const { toast } = useToast();

  const handleSearch = () => {
    if (searchInput.trim() !== "") {
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Sign in to use hybrid search capabilities for better results",
          status: "info",
          duration: 5000,
          isClosable: true,
        });
      }
      onSearch();
    }
  };

  return (
    <div className="mb-6 sm:mb-8 max-w-2xl mx-auto">
      <div className="backdrop-blur-sm bg-white/30 dark:bg-dark-card/30 rounded-full border border-white/20 dark:border-dark-text/10 p-1 shadow-md">
        <SearchBar
          value={searchInput}
          onChange={onSearchChange}
          onEnter={handleSearch}
          placeholder="Search clubs..."
          className="w-full bg-transparent text-dark-base dark:text-dark-text py-2 sm:py-3 px-4 sm:px-5 rounded-full outline-none placeholder:text-dark-base/50 dark:placeholder:text-dark-text/50 text-sm sm:text-base"
        />
      </div>
    </div>
  );
}