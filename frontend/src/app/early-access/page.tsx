import { Landing } from "@/components/announcements/Landing";

export const metadata = {
  title: "Early access",
  alternates: { canonical: "/early-access" },
  description:
    "What Samā4 does today, a short demo of inline explanations, and the waitlist for sign-in and a personalized edition.",
};

/** What Samā4 does today, a demo, and the waitlist for sign-in and personalization. */
export default function EarlyAccessPage() {
  return <Landing />;
}
