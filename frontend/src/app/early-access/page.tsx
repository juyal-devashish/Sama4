import { Landing } from "@/components/announcements/Landing";

export const metadata = {
  title: "Early access",
  alternates: { canonical: "/early-access" },
  description:
    "What Samā4 is, a short demo of inline explanations, and how to join the early-access waitlist.",
};

/** What Samā4 is, a demo, and the early-access waitlist, inside the app. */
export default function EarlyAccessPage() {
  return <Landing />;
}
