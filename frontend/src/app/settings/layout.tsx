import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Choose your theme and the topics shown in Samā4's daily feed.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
