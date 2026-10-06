"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

// shadcn-style Sheet on Radix Dialog (already in the tree via cmdk; now a
// direct dep). Only the bottom side is needed so far: phone event details.
export const Sheet = DialogPrimitive.Root;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({ className, children, ...props }) {
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
			<DialogPrimitive.Content
				className={cn(
					"fixed inset-x-0 bottom-0 z-[71] flex max-h-[85dvh] flex-col rounded-t-xl border-t border-border bg-popover text-popover-foreground outline-none",
					"data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:duration-200 data-[state=closed]:duration-150",
					className,
				)}
				{...props}
			>
				<div className="flex shrink-0 justify-center pb-1 pt-2" aria-hidden>
					<span className="h-1 w-9 rounded-full bg-border" />
				</div>
				<div className="min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">{children}</div>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
}
