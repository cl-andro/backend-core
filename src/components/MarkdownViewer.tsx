import ReactMarkdown from "react-markdown";
import { useMemo } from "react";

interface MarkdownViewerProps {
  content: string;
}

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  // Use useMemo to prevent re-rendering the markdown parser on every render
  const contentToRender = useMemo(() => content, [content]);

  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown>{contentToRender}</ReactMarkdown>
    </div>
  );
}