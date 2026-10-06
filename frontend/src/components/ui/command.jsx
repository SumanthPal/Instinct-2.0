"use client";
import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { FaSearch } from "react-icons/fa";
import { cn } from "@/lib/utils";

export function Command({ className, ...props }) {
  return (
    <CommandPrimitive
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CommandInput({ className, ...props }) {
  return (
    <div className="flex items-center border-b border-border px-3" cmdk-input-wrapper="">
      <FaSearch className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
      <CommandPrimitive.Input
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }) {
  return <CommandPrimitive.List className={cn("max-h-72 overflow-y-auto overflow-x-hidden p-1", className)} {...props} />;
}
export function CommandEmpty({ className, ...props }) {
  return <CommandPrimitive.Empty className={cn("py-6 text-center text-sm text-muted-foreground", className)} {...props} />;
}
export function CommandGroup({ className, ...props }) {
  return (
    <CommandPrimitive.Group
      className={cn("overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground", className)}
      {...props}
    />
  );
}
export function CommandItem({ className, ...props }) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
