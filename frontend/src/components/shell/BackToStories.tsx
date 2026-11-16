import Link from "next/link";

/** The closing line of the info pages (About, Sources, How explanations are made, Privacy). */
export function BackToStories() {
  return (
    <p className="mt-9">
      <Link href="/" className="label-ui link-ui font-bold text-accent-secondary">
        Back to today&apos;s stories
      </Link>
    </p>
  );
}
