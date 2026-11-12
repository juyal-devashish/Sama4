/** Source tags the follow-up answer prompt asks Claude to put after each fact. */
export const CITATION_TAGS = ["article", "explanation", "Wikipedia", "outlook"] as const;
export type CitationTag = (typeof CITATION_TAGS)[number];

export type AnswerPart = { text: string } | { tag: CitationTag };

const TAG_PATTERN = /\s*\[(article|explanation|wikipedia|outlook)\]/gi;

function canonical(tag: string): CitationTag {
  return CITATION_TAGS.find((t) => t.toLowerCase() === tag.toLowerCase()) ?? "article";
}

/** Split an answer into text and the [source] tags that follow its sentences. */
export function splitCitations(answer: string): AnswerPart[] {
  const parts: AnswerPart[] = [];
  let last = 0;
  const pattern = new RegExp(TAG_PATTERN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(answer)) !== null) {
    const before = answer.slice(last, match.index);
    if (before) parts.push({ text: before });
    parts.push({ tag: canonical(match[1]) });
    last = match.index + match[0].length;
  }
  const rest = answer.slice(last);
  if (rest) parts.push({ text: rest });
  return parts;
}
