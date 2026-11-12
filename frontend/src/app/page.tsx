import { Suspense } from "react";
import { Reader } from "@/components/reader/Reader";

export default function TodayPage() {
  return (
    <Suspense>
      <Reader />
    </Suspense>
  );
}
