import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        h1: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
        h2: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
        h3: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="bg-black/20 rounded px-1 py-0.5 text-[0.85em] font-mono">{children}</code>
        ),
        pre: ({ children }) => (
          <pre className="bg-black/20 rounded-xl p-2 mb-2 last:mb-0 overflow-x-auto text-[0.85em] font-mono">{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-current/30 pl-2 opacity-80 mb-2 last:mb-0">{children}</blockquote>
        ),
        hr: () => <hr className="border-current/20 my-2" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2 last:mb-0">
            <table className="text-[0.85em] border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-current/30">{children}</thead>,
        th: ({ children }) => <th className="text-left font-semibold px-2 py-1 whitespace-nowrap">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1 align-top whitespace-nowrap">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
