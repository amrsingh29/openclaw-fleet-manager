import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../context/ThemeContext';

interface MarkdownRendererProps {
    content: string;
    /** Force light-on-color palette (used inside the Commander's own bubble). */
    onAccent?: boolean;
    className?: string;
}

/**
 * Agents write chat messages where a single newline is a real line break, not a
 * paragraph join. remark-gfm would collapse those into spaces, so turn every
 * soft newline inside text into an explicit mdast `break` node.
 */
function remarkSoftBreaks() {
    return (tree: unknown) => {
        const walk = (node: any) => {
            if (!node.children || node.type === 'code' || node.type === 'inlineCode') return;
            node.children = node.children.flatMap((child: any) => {
                if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('\n')) {
                    const out: any[] = [];
                    child.value.split('\n').forEach((part: string, i: number) => {
                        if (i > 0) out.push({ type: 'break' });
                        if (part.length) out.push({ type: 'text', value: part });
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

/**
 * Compact markdown renderer for chat bubbles and other agent-authored text.
 * Maps every element explicitly instead of relying on `prose` so it stays
 * readable inside a small bubble in both themes.
 */
export function MarkdownRenderer({ content, onAccent = false, className = '' }: MarkdownRendererProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark' && !onAccent;

    const body = onAccent ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-800';
    const inlineCode = onAccent
        ? 'bg-white/20 text-white'
        : isDark
            ? 'bg-black/40 text-cyan-300 border border-white/10'
            : 'bg-slate-200/70 text-slate-800 border border-slate-300/60';
    const blockBg = onAccent
        ? 'bg-black/25 border-white/20'
        : isDark
            ? 'bg-[#0d1117] border-white/10'
            : 'bg-slate-50 border-slate-200';
    const link = onAccent ? 'text-white underline' : isDark ? 'text-cyan-400' : 'text-blue-600';
    const rule = onAccent ? 'border-white/30' : isDark ? 'border-white/10' : 'border-slate-200';

    return (
        <div className={`text-sm leading-relaxed break-words [overflow-wrap:anywhere] ${body} ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkSoftBreaks]}
                components={{
                    p: ({ node, ...props }) => <p className="my-1 first:mt-0 last:mb-0" {...props} />,
                    h1: ({ node, ...props }) => <h1 className="text-base font-bold mt-3 mb-1.5 first:mt-0" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-sm font-bold mt-3 mb-1.5 first:mt-0" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-xs font-bold mt-2 mb-1 first:mt-0" {...props} />,
                    h4: ({ node, ...props }) => <h4 className="text-xs font-semibold mt-2 mb-1 first:mt-0" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
                    em: ({ node, ...props }) => <em className="italic opacity-90" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5" {...props} />,
                    li: ({ node, ...props }) => <li className="pl-0.5 [&>p]:my-0" {...props} />,
                    a: ({ node, ...props }) => (
                        <a
                            className={`${link} underline-offset-2 hover:opacity-80`}
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                        />
                    ),
                    pre: ({ node, ...props }) => (
                        <pre
                            className={`my-2 rounded-lg border px-3 py-2 text-xs overflow-x-auto font-mono ${blockBg} [&>code]:bg-transparent [&>code]:border-0 [&>code]:p-0 [&>code]:text-[0.95em]`}
                            {...props}
                        />
                    ),
                    code: ({ node, className: codeClass, ...props }) => {
                        const isBlock = /language-/.test(codeClass || '');
                        if (isBlock) {
                            return <code className={`font-mono ${onAccent ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-800'}`} {...props} />;
                        }
                        return <code className={`rounded px-1 py-0.5 text-[0.85em] font-mono ${inlineCode}`} {...props} />;
                    },
                    blockquote: ({ node, ...props }) => (
                        <blockquote
                            className={`border-l-2 pl-3 my-2 italic ${onAccent ? 'border-white/50 text-white/90' : isDark ? 'border-cyan-500/50 text-slate-300' : 'border-blue-400 text-slate-600'}`}
                            {...props}
                        />
                    ),
                    hr: ({ node, ...props }) => <hr className={`my-3 border-t ${rule}`} {...props} />,
                    table: ({ node, ...props }) => (
                        <div className="my-2 overflow-x-auto">
                            <table className={`w-full border-collapse text-xs ${rule}`} {...props} />
                        </div>
                    ),
                    th: ({ node, ...props }) => (
                        <th className={`border px-2 py-1 text-left font-bold ${rule}`} {...props} />
                    ),
                    td: ({ node, ...props }) => <td className={`border px-2 py-1 align-top ${rule}`} {...props} />,
                    img: ({ node, ...props }) => <img className="max-w-full rounded-lg my-2" {...props} />,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
