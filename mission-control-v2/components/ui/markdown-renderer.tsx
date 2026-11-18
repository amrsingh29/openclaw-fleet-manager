"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

/**
 * Agents write chat messages where a single newline is a real line break, not a
 * paragraph join. remark-gfm would collapse those into spaces, so turn every
 * soft newline inside text into an explicit mdast `break` node.
 */
export function remarkSoftBreaks() {
    return (tree: unknown) => {
        const walk = (node: any) => {
            if (!node.children || node.type === "code" || node.type === "inlineCode") return;
            node.children = node.children.flatMap((child: any) => {
                if (child.type === "text" && typeof child.value === "string" && child.value.includes("\n")) {
                    const out: any[] = [];
                    child.value.split("\n").forEach((part: string, i: number) => {
                        if (i > 0) out.push({ type: "break" });
                        if (part.length) out.push({ type: "text", value: part });
                    });
                    return out;
                }
                walk(child);
                return child;
            });
        };
        walk(tree);
    };
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
    return (
        <div className={cn(
            "prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere]",
            "prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl",
            "prose-code:text-amber-600 dark:prose-code:text-amber-300 prose-code:bg-amber-400/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none",
            "prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline",
            "prose-p:leading-relaxed prose-p:my-1",
            "prose-ul:my-2 prose-ol:my-2",
            "prose-li:my-0.5",
            className
        )}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkSoftBreaks]}
                components={{
                    h1: ({ node, ...props }) => <h1 className="text-sm font-bold mt-4 mb-2 first:mt-0" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-[13px] font-bold mt-3 mb-1 first:mt-0" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-xs font-bold mt-2 mb-1 first:mt-0" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-0.5" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-0.5" {...props} />,
                    blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-2 border-cyan-500/50 pl-4 py-1 my-2 bg-cyan-500/5 italic" {...props} />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
