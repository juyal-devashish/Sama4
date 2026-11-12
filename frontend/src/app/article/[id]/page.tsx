import { redirect } from "next/navigation";

/** Shared story links open in the reader with that story selected. */
export default function ArticleLink({ params }: { params: { id: string } }) {
  redirect(`/?article=${encodeURIComponent(params.id)}`);
}
