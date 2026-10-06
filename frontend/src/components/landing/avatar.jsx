import ClubAvatar from "@/components/ClubAvatar";

// Landing-page wrapper around the shared ClubAvatar (onError fallback,
// pre-hydration 404 check, keyed on src); only the ring and size live here.
export function Avatar({ src, className = "h-10 w-10", sizes = "64px" }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted ${className}`}
    >
      <ClubAvatar src={src} alt="" sizes={sizes} />
    </span>
  );
}
