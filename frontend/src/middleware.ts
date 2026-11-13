import { NextResponse, type NextRequest } from "next/server";
import { readerHref } from "@/lib/routes";

/**
 * Old links used /?article=<id>. Send them to the story's own URL with a permanent
 * redirect, before rendering starts (a redirect thrown while streaming can't set a status).
 */
export function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const article = searchParams.get("article");
  if (!article) return NextResponse.next();
  return NextResponse.redirect(new URL(readerHref(article, searchParams), request.url), 308);
}

export const config = { matcher: "/" };
