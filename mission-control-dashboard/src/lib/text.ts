/**
 * Turn agent-authored markdown into readable plain text for tight spaces
 * (kanban card previews, tooltips) where a full markdown tree would be noise.
 * Markers are removed, their text content is kept.
 */
export function markdownToPlainText(md: string): string {
    if (!md) return '';

    let out = md;

    // Fenced code blocks: keep the code, drop the fences and language tag.
    out = out.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_m, code: string) => code);
    // Indented code / stray single fences.
    out = out.replace(/^```.*$/gm, '');

    // Images -> alt text, links -> "text (url)" only when the url adds meaning.
    out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

    // Headings, blockquotes, list markers, task-list boxes, rules.
    out = out.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    out = out.replace(/^\s{0,3}>\s?/gm, '');
    out = out.replace(/^\s{0,3}[-*+]\s+\[[ xX]\]\s+/gm, '');
    out = out.replace(/^\s{0,3}[-*+]\s+/gm, '• ');
    out = out.replace(/^\s{0,3}\d+[.)]\s+/gm, (m) => m.trim() + ' ');
    out = out.replace(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/gm, '');
    // Table separator rows, then pipe padding.
    out = out.replace(/^\s*\|?[\s:-]*\|[\s|:-]*$/gm, '');
    out = out.replace(/^\s*\|(.*)\|\s*$/gm, (_m, row: string) =>
        row.split('|').map((c) => c.trim()).filter(Boolean).join(' · ')
    );

    // Inline emphasis and code spans.
    out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
    out = out.replace(/\*\*([^*]+)\*\*/g, '$1');
    out = out.replace(/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, '$1$2');
    out = out.replace(/(^|[^\w_])__([^_]+)__(?![\w_])/g, '$1$2');
    out = out.replace(/`([^`]+)`/g, '$1');

    // Collapse whitespace: blank-line paragraphs -> single break for previews.
    return out
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** One-line summary of a markdown blob, for tooltips and list cells. */
export function markdownToOneLine(md: string, max = 200): string {
    const plain = markdownToPlainText(md).replace(/\s+/g, ' ').trim();
    return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}
