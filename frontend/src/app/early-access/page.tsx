import type { Metadata } from "next";
import { Landing } from "@/components/announcements/Landing";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Early access",
  path: "/early-access",
  description:
    "What Samā4 does today, a short demo of inline explanations, and the waitlist for sign-in and a personalized edition.",
});

/** What Samā4 does today, a demo, and the waitlist for sign-in and personalization. */
export default function EarlyAccessPage() {
  return <Landing />;
}
