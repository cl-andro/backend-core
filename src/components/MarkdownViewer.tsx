import ReactMarkdown from "react-markdown";
import React, { useMemo } from "react";

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
            if (isPlaceholder) return null;
            return (
              <strong className="font-bold" {...props}>
                {children}
              </strong>
            );
          },
          em: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            if (isPlaceholder) return null;
            return (
              <em className="italic" {...props}>
                {children}
              </em>
            );
          },
          code: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            if (isPlaceholder) return null;
            return (
              <code {...props}>
                {children}
              </code>
            );
          },
          li: ({ node, children, ...props }) => {
            const cleanChildren = React.Children.map(children, (child) => {
              if (typeof child === "string" && isPlaceholderText(child)) {
                return "";
              }
              if (React.isValidElement(child) && isPlaceholderText(child)) {
                return null;
              }
              return child;
            });
            return (
              <li {...props}>
                {cleanChildren}
              </li>
            );
          },
          a: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            if (isPlaceholder) return null;
            return (
              <a className="text-[#1877f2] underline font-medium hover:text-[#166fe5]" {...props}>
                {children}
              </a>
            );
          },
          blockquote: ({ node, children, ...props }) => {
            const isPlaceholder = isPlaceholderText(children);
            if (isPlaceholder) return null;
            return (
              <blockquote {...props}>
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