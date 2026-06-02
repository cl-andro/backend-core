"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  Code, 
  Bold, 
  Italic, 
  Link2, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Quote, 
  Loader2 
} from "lucide-react";
import MarkdownViewer from "@/components/MarkdownViewer";

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: any) => void;
  session: any;
  currentDev: any;
}

export default function PostModal({ isOpen, onClose, onPostCreated, session, currentDev }: PostModalProps) {
  const [postContent, setPostContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("post-modal-open");
    } else {
      document.body.classList.remove("post-modal-open");
    }
    return () => {
      document.body.classList.remove("post-modal-open");
    };
  }, [isOpen]);

  // Auto-focus textarea and handle keybinds when modal opens
  useEffect(() => {
    if (isOpen) {
      setPostContent("");
      setEditorTab("write");
      // Add a tiny delay to ensure input focus is triggered after transition
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleFormat = (type: "bold" | "italic" | "code" | "codeblock" | "link" | "quote" | "bullet" | "ordered" | "task") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let insertion = "";
    let selectionOffsetStart = 0;
    let selectionOffsetEnd = 0;

    switch (type) {
      case "bold":
        if (selectedText) {
          insertion = `**${selectedText}**`;
          selectionOffsetStart = 2;
          selectionOffsetEnd = insertion.length - 2;
        } else {
          insertion = `****`;
          selectionOffsetStart = 2;
          selectionOffsetEnd = 2;
        }
        break;
      case "italic":
        if (selectedText) {
          insertion = `*${selectedText}*`;
          selectionOffsetStart = 1;
          selectionOffsetEnd = insertion.length - 1;
        } else {
          insertion = `**`;
          selectionOffsetStart = 1;
          selectionOffsetEnd = 1;
        }
        break;
      case "code":
        if (selectedText) {
          insertion = `\`${selectedText}\``;
          selectionOffsetStart = 1;
          selectionOffsetEnd = insertion.length - 1;
        } else {
          insertion = `\`\``;
          selectionOffsetStart = 1;
          selectionOffsetEnd = 1;
        }
        break;
      case "codeblock":
        if (selectedText) {
          insertion = `\n\`\`\`\n${selectedText}\n\`\`\`\n`;
          selectionOffsetStart = 5;
          selectionOffsetEnd = insertion.length - 5;
        } else {
          insertion = `\n\`\`\`\n\n\`\`\`\n`;
          selectionOffsetStart = 5;
          selectionOffsetEnd = 5;
        }
        break;
      case "link":
        if (selectedText) {
          insertion = `[${selectedText}](https://)`;
          selectionOffsetStart = selectedText.length + 3; // start of 'https://'
          selectionOffsetEnd = selectedText.length + 11; // end of 'https://'
        } else {
          insertion = `[](https://)`;
          selectionOffsetStart = 1; // cursor inside '[]'
          selectionOffsetEnd = 1;
        }
        break;
      case "quote":
        if (selectedText) {
          insertion = `\n> ${selectedText}\n`;
          selectionOffsetStart = 3;
          selectionOffsetEnd = insertion.length - 1;
        } else {
          insertion = `\n> `;
          selectionOffsetStart = 3;
          selectionOffsetEnd = 3;
        }
        break;
      case "bullet":
        if (selectedText) {
          insertion = `\n- ${selectedText}`;
          selectionOffsetStart = 3;
          selectionOffsetEnd = insertion.length;
        } else {
          insertion = `\n- `;
          selectionOffsetStart = 3;
          selectionOffsetEnd = 3;
        }
        break;
      case "ordered":
        if (selectedText) {
          insertion = `\n1. ${selectedText}`;
          selectionOffsetStart = 4;
          selectionOffsetEnd = insertion.length;
        } else {
          insertion = `\n1. `;
          selectionOffsetStart = 4;
          selectionOffsetEnd = 4;
        }
        break;
      case "task":
        if (selectedText) {
          insertion = `\n- [ ] ${selectedText}`;
          selectionOffsetStart = 8;
          selectionOffsetEnd = insertion.length;
        } else {
          insertion = `\n- [ ] `;
          selectionOffsetStart = 7;
          selectionOffsetEnd = 7;
        }
        break;
      default:
        return;
    }

    const newText = text.substring(0, start) + insertion + text.substring(end);
    setPostContent(newText);

    // Restore selection/focus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + selectionOffsetStart, start + selectionOffsetEnd);
    }, 0);
  };

  const handleTextareaSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const val = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const PLACEHOLDERS = [
      "task item",
      "bold text",
      "italic text",
      "code block",
      "link text",
      "quote",
      "list item"
    ];

    if (start === end) {
      // Check standard placeholders
      for (const placeholder of PLACEHOLDERS) {
        let index = -1;
        while ((index = val.indexOf(placeholder, index + 1)) !== -1) {
          if (start >= index && start <= index + placeholder.length) {
            textarea.setSelectionRange(index, index + placeholder.length);
            return;
          }
        }
      }

      // Check for raw 'https://' placeholder inside link brackets e.g. '(https://)'
      let index = -1;
      const target = "https://";
      while ((index = val.indexOf(target, index + 1)) !== -1) {
        if (val.charAt(index + target.length) === ")") {
          if (start >= index && start <= index + target.length) {
            textarea.setSelectionRange(index, index + target.length);
            return;
          }
        }
      }
    }
  };


  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let providerToken = session?.provider_token;
      if (!providerToken && typeof window !== "undefined") {
        providerToken = localStorage.getItem("gh_provider_token") || undefined;
      }
      if (providerToken) {
        headers["x-github-token"] = providerToken;
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers,
        body: JSON.stringify({ content: postContent }),
      });
      const data = await res.json();

      if (res.ok && data.post) {
        onPostCreated(data.post);
        setPostContent("");
        onClose();
      } else {
        alert(data.error || "Failed to create post");
      }
    } catch (err) {
      console.error(err);
      alert("Error posting content");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300 animate-in fade-in">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white border border-[#dadde1] w-full max-w-xl rounded-t-lg sm:rounded-lg shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-200">
        
        {/* Header */}
        <div className="bg-[#f5f6f7] px-4 py-3 border-b border-[#dadde1] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-1.5 font-bold text-xs text-[#4b4f56] uppercase">
            <Code className="h-3.5 w-3.5 text-[#3b5998]" />
            Create Post
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-gray-500 hover:text-black p-1 hover:bg-[#e4e6eb] rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex justify-between items-center px-4 bg-[#f5f6f7] border-b border-[#dadde1] shrink-0">
          <div className="text-[10px] text-gray-500 font-mono">
            Save to DB & Sync with GitHub
          </div>
          <div className="flex bg-white border-l border-r border-t border-[#dadde1] rounded-t-sm overflow-hidden mt-1.5">
            <button
              type="button"
              onClick={() => setEditorTab("write")}
              className={`px-4 py-1.5 text-[11px] font-bold uppercase transition-all duration-150 ${
                editorTab === "write"
                  ? "border-b-2 border-[#3b5998] text-[#3b5998] bg-white"
                  : "border-b-2 border-transparent text-[#65676b] hover:text-[#1c1e21] bg-[#f5f6f7]"
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setEditorTab("preview")}
              className={`px-4 py-1.5 text-[11px] font-bold uppercase transition-all duration-150 ${
                editorTab === "preview"
                  ? "border-b-2 border-[#3b5998] text-[#3b5998] bg-white"
                  : "border-b-2 border-transparent text-[#65676b] hover:text-[#1c1e21] bg-[#f5f6f7]"
              }`}
            >
              Preview
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handlePostSubmit} className="flex-1 flex flex-col overflow-hidden p-4 bg-white">
          {editorTab === "write" ? (
            <div className="flex-1 flex flex-col min-h-0 space-y-3">
              {/* Markdown Formatting Toolbar */}
              <div className="flex items-center gap-1 pb-2 border-b border-[#dadde1] flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => handleFormat("bold")}
                  title="Bold"
                  className="p-1.5 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFormat("italic")}
                  title="Italic"
                  className="p-1.5 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center"
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFormat("code")}
                  title="Inline Code"
                  className="p-1.5 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center"
                >
                  <Code className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFormat("codeblock")}
                  title="Code Block"
                  className="p-1.5 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center font-mono text-[9px] font-bold px-2"
                >
                  {"{ }"}
                </button>
                <span className="mx-1.5 h-5 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={() => handleFormat("link")}
                  title="Link"
                  className="p-1.5 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center"
                >
                  <Link2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFormat("quote")}
                  title="Quote"
                  className="p-1.5 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center"
                >
                  <Quote className="h-4 w-4" />
                </button>
                <span className="mx-1.5 h-5 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={() => handleFormat("bullet")}
                  title="Bullet List"
                  className="p-1.5 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFormat("ordered")}
                  title="Numbered List"
                  className="p-1.5 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center"
                >
                  <ListOrdered className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleFormat("task")}
                  title="Task List"
                  className="p-1.5 hover:bg-[#f2f3f5] rounded transition-colors text-gray-600 hover:text-black flex items-center justify-center"
                >
                  <CheckSquare className="h-4 w-4" />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                placeholder={`What's on your mind, ${currentDev?.name || "Developer"}? Write here, sync to GitHub... (Supports Markdown)`}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                onSelect={handleTextareaSelection}
                className="flex-1 w-full text-sm resize-none focus:outline-none border-transparent p-1.5 rounded-sm min-h-[150px]"
                maxLength={1000}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-1.5 py-2 border border-dashed border-gray-300 rounded-sm bg-gray-50 min-h-[200px] select-text">
              {postContent.trim() ? (
                <MarkdownViewer content={postContent} />
              ) : (
                <span className="text-gray-400 text-xs italic">Nothing to preview</span>
              )}
            </div>
          )}

          {/* Footer Controls */}
          <div className="mt-4 pt-3 border-t border-[#dadde1] flex justify-between items-center shrink-0">
            <span className="text-[10px] text-gray-400 font-mono">
              {postContent.length}/1000 characters
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-[#4b4f56] text-xs font-bold px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!postContent.trim() || isSubmitting}
                className="bg-[#3b5998] hover:bg-[#304d8a] disabled:bg-[#8a9cc2] text-white text-xs font-bold px-5 py-2 rounded transition-all shadow-sm flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                Share
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
