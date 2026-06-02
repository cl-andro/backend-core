import ReactMarkdown from "react-markdown";
import { useMemo } from "react";

interface MarkdownViewerProps {
  content: string;
}

function getTextFromChildren(children: any): string {
  if (!children) return "";
  if (typeof children === "string") return children;
  if (Array.isArray(children)) {
    return children.map(getTextFromChildren).join("");
  }
  if (children.props && children.props.children) {
    return getTextFromChildren(children.props.children);
  }
  return "";
}

const PLACEHOLDERS = [
  "bold text",
  "italic text",
  "code",
  "code block",
  "link text",
  "quote",
  "list item",
  "task item"
];

function isPlaceholderText(children: any): boolean {
  const text = getTextFromChildren(children).toLowerCase().trim();
  return PLACEHOLDERS.some(p => text === p || text.includes(p));
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  const contentToRender = useMemo(() => content, [content]);

  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        components={{
          strong: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            return (
              <strong 
                className={isPlaceholder ? "text-gray-400 opacity-60 italic font-normal" : "font-bold"} 
                {...props}
              >
                {children}
              </strong>
            );
          },
          em: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            return (
              <em 
                className={isPlaceholder ? "text-gray-400 opacity-60 italic font-normal" : "italic"} 
                {...props}
              >
                {children}
              </em>
            );
          },
          code: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            return (
              <code 
                className={isPlaceholder ? "text-gray-400 opacity-60 italic font-normal" : ""} 
                {...props}
              >
                {children}
              </code>
            );
          },
          li: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            return (
              <li 
                className={isPlaceholder ? "text-gray-400 opacity-60 italic list-none" : ""} 
                {...props}
              >
                {children}
              </li>
            );
          },
          a: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            return (
              <a 
                className={isPlaceholder ? "text-gray-400 opacity-60 italic no-underline pointer-events-none" : "text-[#1877f2] underline font-medium hover:text-[#166fe5]"} 
                {...props}
              >
                {children}
              </a>
            );
          },
          blockquote: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            return (
              <blockquote 
                className={isPlaceholder ? "text-gray-300 opacity-50 italic font-normal border-l-2 border-gray-200" : ""} 
                {...props}
              >
                {children}
              </blockquote>
            );
          }
        }}
      >
        {contentToRender}
      </ReactMarkdown>
    </div>
  );
}