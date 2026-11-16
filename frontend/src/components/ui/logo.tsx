import { cn } from "@/lib/utils";

/** The files are 108x128 WebP (about 7 KB each), enough for the largest use (64px, at 2x). */
const SIZE = { width: 108, height: 128 };

/**
 * The Samā4 owl. Two images, one per theme: CSS picks the right one from `html.dark`
 * (set before first paint), so it never flashes the wrong colour and works without JS.
 * Decorative by default; pass `alt` when the logo is the only label.
 */
export function Logo({ className, alt = "" }: { className?: string; alt?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-owl.webp"
        {...SIZE}
        alt={alt}
        className={cn("w-auto dark:hidden", className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-owl-dark.webp"
        {...SIZE}
        alt={alt}
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}
