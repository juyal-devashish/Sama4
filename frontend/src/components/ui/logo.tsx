import { cn } from "@/lib/utils";

/**
 * The samā4 owl. Two images, one per theme: CSS picks the right one from `html.dark`
 * (set before first paint), so it never flashes the wrong colour and works without JS.
 * Decorative by default; pass `alt` when the logo is the only label.
 */
export function Logo({ className, alt = "" }: { className?: string; alt?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-owl.png" alt={alt} className={cn("w-auto dark:hidden", className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-owl-dark.png"
        alt={alt}
        className={cn("hidden w-auto dark:block", className)}
      />
    </>
  );
}
