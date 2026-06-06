"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Folder, 
  File, 
  Code2, 
  GitBranch, 
  GitCommit, 
  HardDrive, 
  Github, 
  RefreshCw, 
  Plus, 
  FolderPlus, 
  Trash2, 
  X, 
  Terminal, 
  Check, 
  Save, 
  Eye, 
  EyeOff, 
  ChevronRight,
  ArrowLeft,
  Loader2,
  FileText,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";
import MarkdownViewer from "@/components/MarkdownViewer";

// Client-side path helper utilities
function getBasename(filePath: string) {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || "";
}

function getDirname(filePath: string) {
  const idx = filePath.lastIndexOf("/");
  return idx === -1 ? "" : filePath.substring(0, idx);
}

function joinPaths(part1: string, part2: string) {
  const clean1 = part1.replace(/\/+$/, "");
  const clean2 = part2.replace(/^\/+/, "");
  if (!clean1) return clean2;
  if (!clean2) return clean1;
  return `${clean1}/${clean2}`;
}

interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
  ext?: string;
}

interface ProjectItem {
  name: string;
  path: string;
}

interface GitChangedFile {
  code: string;
  path: string;
}

export default function WorkspaceClient() {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  // Session & Auth
  const [session, setSession] = useState<any>(null);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);

  // App Modes: 'local' (server disk) vs 'github' (remote API)
  const [mode, setMode] = useState<"local" | "github">("local");

  // Project Lists
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [currentProject, setCurrentProject] = useState<string>(""); // folder name

  // GitHub Repos (for GitHub mode)
  const [repos, setRepos] = useState<any[]>([]);
  const [currentRepo, setCurrentRepo] = useState<string>(""); // "owner/repo"
  const [githubToken, setGithubToken] = useState<string | null>(null);

  // File Tree
  const [rootFiles, setRootFiles] = useState<FileItem[]>([]);
  const [folderContents, setFolderContents] = useState<Record<string, FileItem[]>>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Editor State
  const [openFiles, setOpenFiles] = useState<string[]>([]); // paths of open files
  const [activeFile, setActiveFile] = useState<string | null>(null); // path of currently open file
  const [fileContents, setFileContents] = useState<Record<string, string>>({}); // path -> content
  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set()); // paths of edited files
  const [editorContent, setEditorContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  // Markdown Side-by-Side Preview
  const [showPreview, setShowPreview] = useState(false);

  // Git State
  const [gitBranch, setGitBranch] = useState("main");
  const [gitChanges, setGitChanges] = useState<GitChangedFile[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [isGitActionLoading, setIsGitActionLoading] = useState(false);
  
  // Console log logs
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [showConsole, setShowConsole] = useState(true);
  const [terminalInput, setTerminalInput] = useState("");
  const [isTerminalRunning, setIsTerminalRunning] = useState(false);
  const [clAndroSocket, setClAndroSocket] = useState<WebSocket | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);

  // Loaders
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);

  // Dialog State (New File / New Folder / Delete)
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: "file" | "folder" | "delete";
    parentPath: string; // for new items
    targetPath?: string; // for delete
    name: string;
  } | null>(null);

  // Active Tab in Sidebar: 'explorer' | 'git' | 'siblings' | 'terminal'
  const [sidebarTab, setSidebarTab] = useState<"explorer" | "git" | "siblings" | "terminal">("explorer");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Lock body and html viewport scroll on mount, restore on unmount
  useEffect(() => {
    const originalStyle = document.body.style.cssText;
    document.body.style.overflow = "hidden";
    document.body.style.height = "100%";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    const html = document.documentElement;
    const originalHtmlStyle = html.style.cssText;
    html.style.overflow = "hidden";
    html.style.height = "100%";

    const handleWindowScroll = () => {
      window.scrollTo(0, 0);
    };
    window.addEventListener("scroll", handleWindowScroll, { passive: true });

    // Prevent viewport scroll chaining and scroll up when typing/swiping
    let touchStartClientY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartClientY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      let target = e.target as HTMLElement | null;
      let isScrollable = false;
      
      while (target && target !== document.body) {
        const style = window.getComputedStyle(target);
        const overflowY = style.overflowY;
        const isScrollableY = (overflowY === "auto" || overflowY === "scroll") && target.scrollHeight > target.clientHeight;
        
        if (isScrollableY) {
          const scrollTop = target.scrollTop;
          const scrollHeight = target.scrollHeight;
          const clientHeight = target.clientHeight;
          if (e.touches.length > 0) {
            const currentY = e.touches[0].clientY;
            const deltaY = currentY - touchStartClientY;
            
            // deltaY > 0 means swiping down (scrolling up)
            // deltaY < 0 means swiping up (scrolling down)
            const isAtTop = scrollTop <= 0 && deltaY > 0;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight && deltaY < 0;
            
            if (!isAtTop && !isAtBottom) {
              isScrollable = true;
            }
          }
          break;
        }
        target = target.parentElement;
      }
      
      if (!isScrollable) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      document.body.style.cssText = originalStyle;
      html.style.cssText = originalHtmlStyle;
      window.removeEventListener("scroll", handleWindowScroll);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // Reset programmatic WebView scrolls on the main container
  const handleContainerScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      containerRef.current.scrollLeft = 0;
    }
  };

  // Helper to ensure window scroll is reset on input focus
  const handleInputFocus = () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
        if (window.visualViewport) {
          const keyboardHeight = window.innerHeight - window.visualViewport.height;
          containerRef.current.style.bottom = `${Math.max(0, keyboardHeight)}px`;
        }
      }
    }, 150);
  };

  const handleTerminalFocus = () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
        containerRef.current.scrollLeft = 0;
        if (window.visualViewport) {
          const keyboardHeight = window.innerHeight - window.visualViewport.height;
          containerRef.current.style.bottom = `${Math.max(0, keyboardHeight)}px`;
        }
      }
      if (terminalScrollRef.current) {
        terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
      }
    }, 150);
  };

  // Scroll terminal to bottom when keyboard opens/resizes viewport
  useEffect(() => {
    const handleResize = () => {
      if (!window.visualViewport) return;
      const viewport = window.visualViewport;
      const keyboardHeight = window.innerHeight - viewport.height;
      
      if (containerRef.current) {
        containerRef.current.style.bottom = `${Math.max(0, keyboardHeight)}px`;
      }

      if (sidebarTab === "terminal" && terminalScrollRef.current) {
        setTimeout(() => {
          if (terminalScrollRef.current) {
            terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
          }
          window.scrollTo(0, 0);
        }, 80);
      }
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    handleResize(); // Initial call
    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [sidebarTab]);

  // 1. Fetch Supabase Session and github provider token
  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      const s = data?.session;
      setSession(s);
      if (s?.user) {
        const login = (
          s.user.user_metadata?.user_name ??
          s.user.user_metadata?.preferred_username ??
          ""
        ).toLowerCase();
        setGithubLogin(login);
      }
      
      const token = localStorage.getItem("gh_provider_token") || s?.provider_token;
      if (token) setGithubToken(token);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
      if (session?.user) {
        const login = (
          session.user.user_metadata?.user_name ??
          session.user.user_metadata?.preferred_username ??
          ""
        ).toLowerCase();
        setGithubLogin(login);
      } else {
        setGithubLogin(null);
      }
      const token = localStorage.getItem("gh_provider_token") || session?.provider_token;
      if (token) setGithubToken(token);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Log message helper
  const addLog = (message: string, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setConsoleLogs((prev) => [`[${timestamp}] ${isError ? "❌" : "ℹ️"} ${message}`, ...prev]);
  };

  const stripAnsi = (str: string) => {
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z0-9\-]*?(?:;[a-zA-Z0-9\-]*?)*?)?[a-zA-Z]/g, "");
  };

  const addRawLog = (text: string) => {
    const cleanText = stripAnsi(text);
    if (!cleanText) return;
    setConsoleLogs((prev) => {
      if (prev.length > 0 && !prev[0].startsWith("[")) {
        return [`${prev[0]}${cleanText}`, ...prev.slice(1)];
      }
      return [cleanText, ...prev];
    });
  };

  const parseTerminalData = (data: string) => {
    // 1. Clear screen sequences
    if (data.includes("\u001b[2J") || data.includes("\u001b[H") || data.includes("\f")) {
      setTerminalLines([]);
      return;
    }

    // 2. Strip ANSI
    const clean = data.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z0-9\-]*?(?:;[a-zA-Z0-9\-]*?)*?)?[a-zA-Z]/g, "");
    if (!clean) return;

    setTerminalLines((prev) => {
      const chunks = clean.split(/\r\n|\n/);
      if (prev.length === 0) {
        return chunks;
      }
      
      const newLines = [...prev];
      const lastLineIdx = newLines.length - 1;
      
      if (data.startsWith("\r")) {
        newLines[lastLineIdx] = chunks[0];
      } else {
        newLines[lastLineIdx] = newLines[lastLineIdx] + chunks[0];
      }
      
      for (let i = 1; i < chunks.length; i++) {
        newLines.push(chunks[i]);
      }
      
      if (newLines.length > 500) {
        return newLines.slice(newLines.length - 500);
      }
      return newLines;
    });
  };

  // Auto-scroll to bottom of terminal screen
  useEffect(() => {
    if (sidebarTab === "terminal" && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalLines, sidebarTab]);

  // Auto-focus terminal input on tab change
  useEffect(() => {
    if (sidebarTab === "terminal") {
      const timer = setTimeout(() => {
        terminalInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [sidebarTab]);

  // Connect/Disconnect Cl-Andro WebSocket
  const toggleClAndroConnection = () => {
    if (socketRef.current) {
      socketRef.current.close();
      setClAndroSocket(null);
      socketRef.current = null;
      addLog("Disconnected from Cl-Andro terminal session.");
    } else {
      connectToClAndro();
    }
  };

  const connectToClAndro = (silent = false) => {
    if (!silent) addLog("Connecting to Cl-Andro terminal session...");
    
    // Close existing socket if any to prevent orphans
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
    }

    try {
      const socket = new WebSocket("ws://127.0.0.1:8080");

      socket.onopen = () => {
        setClAndroSocket(socket);
        socketRef.current = socket;
        addLog("Successfully connected & linked with Cl-Andro terminal session!");
      };

      socket.onmessage = (event) => {
        if (typeof event.data === "string") {
          addRawLog(event.data);
          parseTerminalData(event.data);
        } else if (event.data instanceof Blob) {
          event.data.text().then((text) => {
            addRawLog(text);
            parseTerminalData(text);
          });
        }
      };

      socket.onerror = () => {
        if (!silent) {
          addLog("Could not connect to Cl-Andro. Opening terminal app...", true);
          // Trigger opening the app
          window.location.href = "clandro://share-terminal?port=8080";
          
          // Auto-reconnect after 3 seconds
          setTimeout(() => {
            connectToClAndro(true);
          }, 3000);
        }
      };

      socket.onclose = () => {
        setClAndroSocket(null);
        socketRef.current = null;
      };
    } catch (err: any) {
      if (!silent) addLog(`WebSocket connection error: ${err.message || err}`, true);
    }
  };

  // Auto-connect to Cl-Andro WebSocket
  useEffect(() => {
    if (mode === "local" && !clAndroSocket) {
      connectToClAndro(true);
    }
  }, [mode, clAndroSocket]);

  // Clean up socket only on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);


  // 2. Load Local Sibling Projects
  useEffect(() => {
    if (mode === "local") {
      fetch("/api/workspace/local?action=list-projects")
        .then((res) => res.json())
        .then((data) => {
          if (data.projects) {
            setProjects(data.projects);
          }
          setCurrentProject("");
        })
        .catch((err) => {
          console.error(err);
          addLog("Failed to fetch sibling projects", true);
        });
    }
  }, [mode]);

  // 3. Load Remote GitHub Repos
  useEffect(() => {
    if (mode === "github" && githubToken) {
      setIsTreeLoading(true);
      fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
        },
      })
        .then((res) => res.json())
        .then((data) => {
          setIsTreeLoading(false);
          if (Array.isArray(data)) {
            setRepos(data);
            if (data.length > 0) {
              setCurrentRepo(data[0].full_name);
            }
          } else {
            addLog("Failed to fetch GitHub repositories. Check token scopes.", true);
          }
        })
        .catch((err) => {
          setIsTreeLoading(false);
          console.error(err);
          addLog("Failed to fetch GitHub repos due to connection issues", true);
        });
    }
  }, [mode, githubToken]);

  // 4. Load File Tree on project/repo select
  useEffect(() => {
    if (mode === "local" && typeof currentProject === "string") {
      loadLocalDirectory(currentProject, true);
      loadLocalGitStatus(currentProject);
    } else if (mode === "github" && currentRepo && githubToken) {
      loadGitHubDirectory("", true);
    }
  }, [mode, currentProject, currentRepo, githubToken]);

  // Fetch local folder contents
  const loadLocalDirectory = async (folderPath: string, isRoot = false) => {
    setIsTreeLoading(isRoot);
    try {
      const res = await fetch(`/api/workspace/local?action=list-files&path=${encodeURIComponent(folderPath)}`);
      const data = await res.json();
      if (res.ok && data.items) {
        if (isRoot) {
          setRootFiles(data.items);
          setExpandedFolders(new Set([folderPath]));
        } else {
          setFolderContents((prev) => ({ ...prev, [folderPath]: data.items }));
        }
      } else {
        addLog(`Failed to load folder: ${data.error || "Unknown error"}`, true);
      }
    } catch (e) {
      addLog(`Failed to load folder contents for: ${folderPath}`, true);
    } finally {
      setIsTreeLoading(false);
    }
  };

  // Fetch GitHub folder contents (recursive or shallow via Contents API)
  const loadGitHubDirectory = async (dirPath: string, isRoot = false) => {
    setIsTreeLoading(isRoot);
    try {
      const [owner, repoName] = currentRepo.split("/");
      const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${dirPath}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
        },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        const items: FileItem[] = data.map((file: any) => ({
          name: file.name,
          path: file.path,
          isDir: file.type === "dir",
          size: file.type === "file" ? file.size : undefined,
          ext: file.type === "file" ? file.name.substring(file.name.lastIndexOf(".")) : undefined,
        }));

        // Sort
        items.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });

        if (isRoot) {
          setRootFiles(items);
          setExpandedFolders(new Set([""]));
        } else {
          setFolderContents((prev) => ({ ...prev, [dirPath]: items }));
        }
      } else {
        addLog(`GitHub API failed: ${data.message || "Unknown error"}`, true);
      }
    } catch (e) {
      addLog(`Failed to load GitHub contents for path: ${dirPath}`, true);
    } finally {
      setIsTreeLoading(false);
    }
  };

  // Get local git status
  const loadLocalGitStatus = async (projectPath: string) => {
    try {
      const res = await fetch(`/api/workspace/local?action=git-status&path=${encodeURIComponent(projectPath)}`);
      const data = await res.json();
      if (res.ok) {
        setGitBranch(data.branch);
        setGitChanges(data.files || []);
      }
    } catch (e) {
      console.error("Git status fetch error", e);
    }
  };

  // Toggle folder expansion
  const toggleFolder = (folderPath: string) => {
    const next = new Set(expandedFolders);
    if (next.has(folderPath)) {
      next.delete(folderPath);
      setExpandedFolders(next);
    } else {
      next.add(folderPath);
      setExpandedFolders(next);
      if (mode === "local") {
        loadLocalDirectory(folderPath);
      } else {
        loadGitHubDirectory(folderPath);
      }
    }
  };

  // Load a file into editor
  const openFile = async (filePath: string) => {
    setIsSidebarCollapsed(true);

    // Check if already loaded
    if (fileContents[filePath] !== undefined) {
      setActiveFile(filePath);
      setEditorContent(fileContents[filePath]);
      if (!openFiles.includes(filePath)) {
        setOpenFiles((prev) => [...prev, filePath]);
      }
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return;
    }

    setIsFileLoading(true);
    try {
      if (mode === "local") {
        const res = await fetch(`/api/workspace/local?action=read-file&path=${encodeURIComponent(filePath)}`);
        const data = await res.json();
        if (res.ok && data.content !== undefined) {
          setFileContents((prev) => ({ ...prev, [filePath]: data.content }));
          setEditorContent(data.content);
          setActiveFile(filePath);
          if (!openFiles.includes(filePath)) {
            setOpenFiles((prev) => [...prev, filePath]);
          }
          addLog(`Opened local file: ${filePath}`);
          setTimeout(() => {
            textareaRef.current?.focus();
          }, 150);
        } else {
          addLog(`Failed to read file: ${data.error}`, true);
        }
      } else {
        // GitHub mode file read
        const [owner, repoName] = currentRepo.split("/");
        const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        });
        const data = await res.json();
        if (res.ok && data.content !== undefined) {
          const decoded = atob(data.content.replace(/\s/g, ""));
          setFileContents((prev) => ({ ...prev, [filePath]: decoded }));
          setEditorContent(decoded);
          setActiveFile(filePath);
          if (!openFiles.includes(filePath)) {
            setOpenFiles((prev) => [...prev, filePath]);
          }
          addLog(`Opened remote file from GitHub: ${filePath}`);
          setTimeout(() => {
            textareaRef.current?.focus();
          }, 150);
        } else {
          addLog(`Failed to fetch file from GitHub: ${data.message || res.statusText}`, true);
        }
      }
    } catch (e) {
      addLog(`Error loading file: ${filePath}`, true);
    } finally {
      setIsFileLoading(false);
    }
  };

  // Close tab
  const closeFile = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check if unsaved changes
    if (unsavedChanges.has(filePath)) {
      const confirmClose = window.confirm("You have unsaved changes. Are you sure you want to close?");
      if (!confirmClose) return;
    }

    const nextOpen = openFiles.filter((p) => p !== filePath);
    setOpenFiles(nextOpen);
    
    // Remove unsaved status
    const nextUnsaved = new Set(unsavedChanges);
    nextUnsaved.delete(filePath);
    setUnsavedChanges(nextUnsaved);

    if (activeFile === filePath) {
      if (nextOpen.length > 0) {
        const nextActive = nextOpen[nextOpen.length - 1];
        setActiveFile(nextActive);
        setEditorContent(fileContents[nextActive]);
      } else {
        setActiveFile(null);
        setEditorContent("");
      }
    }
  };

  // Handle textarea modifications
  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEditorContent(val);
    if (activeFile) {
      setFileContents((prev) => ({ ...prev, [activeFile]: val }));
      const nextUnsaved = new Set(unsavedChanges);
      nextUnsaved.add(activeFile);
      setUnsavedChanges(nextUnsaved);
    }
  };

  const handleEditorDoubleClick = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  // Save current active file
  const saveFile = async () => {
    if (!activeFile) return;

    setIsFileLoading(true);
    try {
      if (mode === "local") {
        const res = await fetch("/api/workspace/local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "write-file",
            path: activeFile,
            content: editorContent,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const nextUnsaved = new Set(unsavedChanges);
          nextUnsaved.delete(activeFile);
          setUnsavedChanges(nextUnsaved);
          addLog(`Saved local file: ${activeFile}`);
          loadLocalGitStatus(currentProject);
        } else {
          addLog(`Failed to save: ${data.error}`, true);
        }
      } else {
        // GitHub mode commit/save file
        const [owner, repoName] = currentRepo.split("/");
        // First get current file SHA
        const metaUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${activeFile}`;
        const metaRes = await fetch(metaUrl, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
          },
        });
        const metaData = await metaRes.json();
        const sha = metaRes.ok ? metaData.sha : undefined;

        // Commit content
        const commitRes = await fetch(metaUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Update ${activeFile} via GitSocial Workspace`,
            content: btoa(unescape(encodeURIComponent(editorContent))),
            sha,
          }),
        });
        const commitData = await commitRes.json();
        if (commitRes.ok) {
          const nextUnsaved = new Set(unsavedChanges);
          nextUnsaved.delete(activeFile);
          setUnsavedChanges(nextUnsaved);
          addLog(`Committed & pushed file directly to GitHub: ${activeFile}`);
        } else {
          addLog(`GitHub Commit failed: ${commitData.message || "Unknown error"}`, true);
        }
      }
    } catch (e) {
      addLog(`Error saving file: ${activeFile}`, true);
    } finally {
      setIsFileLoading(false);
    }
  };

  // Keyboard shortcut listener (Ctrl+S or Cmd+S to save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, editorContent, mode, currentProject, currentRepo]);

  // Insert two spaces on tab press inside textarea editor
  const handleTabKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      textarea.value = newValue;
      setEditorContent(newValue);

      if (activeFile) {
        setFileContents((prev) => ({ ...prev, [activeFile]: newValue }));
        const nextUnsaved = new Set(unsavedChanges);
        nextUnsaved.add(activeFile);
        setUnsavedChanges(nextUnsaved);
      }

      setTimeout(() => {
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  // Dialog Operations (Create/Delete)
  const openCreateDialog = (type: "file" | "folder", parent = "") => {
    const pathBase = parent || (mode === "local" ? currentProject : "");
    setDialogState({
      isOpen: true,
      type,
      parentPath: pathBase,
      name: "",
    });
  };

  const openDeleteDialog = (itemPath: string) => {
    setDialogState({
      isOpen: true,
      type: "delete",
      parentPath: "",
      targetPath: itemPath,
      name: getBasename(itemPath),
    });
  };

  const handleDialogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialogState) return;
    const { type, parentPath, targetPath, name } = dialogState;

    if ((type === "file" || type === "folder") && !name.trim()) return;

    setIsTreeLoading(true);
    try {
      if (mode === "local") {
        if (type === "file" || type === "folder") {
          const itemPath = joinPaths(parentPath, name.trim());
          const res = await fetch("/api/workspace/local", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create-item",
              path: itemPath,
              type: type === "folder" ? "directory" : "file",
            }),
          });
          if (res.ok) {
            addLog(`Created local ${type}: ${itemPath}`);
            // Refresh parent
            loadLocalDirectory(parentPath || currentProject, parentPath === "" || parentPath === currentProject);
          } else {
            const data = await res.json();
            alert(data.error || "Failed to create item");
          }
        } else if (type === "delete" && targetPath) {
          const res = await fetch("/api/workspace/local", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "delete-item",
              path: targetPath,
            }),
          });
          if (res.ok) {
            addLog(`Deleted local item: ${targetPath}`);
            // Close tab if open
            setOpenFiles((prev) => prev.filter((p) => p !== targetPath));
            if (activeFile === targetPath) {
              setActiveFile(null);
              setEditorContent("");
            }
            const parentDir = getDirname(targetPath);
            loadLocalDirectory(parentDir || currentProject, !parentDir || parentDir === currentProject);
          } else {
            const data = await res.json();
            alert(data.error || "Failed to delete item");
          }
        }
      } else {
        // GitHub mode Create / Delete
        const [owner, repoName] = currentRepo.split("/");
        if (type === "file") {
          const itemPath = parentPath ? `${parentPath}/${name.trim()}` : name.trim();
          const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${itemPath}`;
          const res = await fetch(url, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${githubToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: `Create ${name.trim()} via GitSocial`,
              content: btoa(""),
            }),
          });
          if (res.ok) {
            addLog(`Created GitHub file: ${itemPath}`);
            loadGitHubDirectory(parentPath, parentPath === "");
          } else {
            const data = await res.json();
            alert(data.message || "Failed to create file");
          }
        } else if (type === "delete" && targetPath) {
          const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${targetPath}`;
          // Get SHA first
          const metaRes = await fetch(url, {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
            },
          });
          const meta = await metaRes.json();
          if (metaRes.ok && meta.sha) {
            const delRes = await fetch(url, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${githubToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: `Delete ${name} via GitSocial`,
                sha: meta.sha,
              }),
            });
            if (delRes.ok) {
              addLog(`Deleted GitHub file: ${targetPath}`);
              setOpenFiles((prev) => prev.filter((p) => p !== targetPath));
              if (activeFile === targetPath) {
                setActiveFile(null);
                setEditorContent("");
              }
              const parent = targetPath.substring(0, targetPath.lastIndexOf("/")) || "";
              loadGitHubDirectory(parent, parent === "");
            } else {
              alert("Failed to delete file");
            }
          }
        } else if (type === "folder") {
          alert("Empty directory creation is not supported by GitHub contents API. You must create a file inside it.");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTreeLoading(false);
      setDialogState(null);
    }
  };

  // Local Git commands trigger
  const runLocalGitCommand = async (cmdType: "pull" | "commit-push") => {
    if (cmdType === "commit-push" && !commitMessage.trim()) {
      alert("Please enter a commit message");
      return;
    }

    setIsGitActionLoading(true);
    addLog(`Running git command: ${cmdType === "pull" ? "git pull" : "git add & commit & push"}...`);
    
    try {
      const res = await fetch("/api/workspace/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "git-action",
          path: currentProject,
          command: cmdType,
          commitMessage: cmdType === "commit-push" ? commitMessage : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.stdout) addLog(`Console Output:\n${data.stdout}`);
        if (data.stderr) addLog(`Console Stderr:\n${data.stderr}`, true);
        addLog(`Git operation '${cmdType}' succeeded!`);
        if (cmdType === "commit-push") setCommitMessage("");
        loadLocalGitStatus(currentProject);
      } else {
        addLog(`Git error: ${data.error}`, true);
        if (data.stderr) addLog(data.stderr, true);
      }
    } catch (e) {
      addLog("Failed to run local git action", true);
    } finally {
      setIsGitActionLoading(false);
    }
  };

  // Interactive Local Terminal command execution
  const handleTerminalSubmit = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const cmd = terminalInput;
    setTerminalInput("");

    if (clAndroSocket && clAndroSocket.readyState === WebSocket.OPEN) {
      clAndroSocket.send(cmd + "\n");
      return;
    }
    
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setIsTerminalRunning(true);
    addLog(`$ ${cmd}`);

    try {
      const res = await fetch("/api/workspace/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run-command",
          path: currentProject,
          command: cmd,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.stdout) addLog(data.stdout);
        if (data.stderr) addLog(data.stderr, true);
        if (!data.stdout && !data.stderr) {
          addLog("Command completed with no output.");
        }
      } else {
        addLog(`Error: ${data.error || "Unknown error"}`, true);
        if (data.stderr) addLog(data.stderr, true);
      }
    } catch (err: any) {
      addLog(`Failed to execute command: ${err.message || err}`, true);
    } finally {
      setIsTerminalRunning(false);
    }
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleTerminalSubmit(e);
      return;
    }

    if (clAndroSocket && clAndroSocket.readyState === WebSocket.OPEN) {
      if (ctrlActive && e.key.length === 1) {
        e.preventDefault();
        const charCode = e.key.toLowerCase().charCodeAt(0);
        if (charCode >= 97 && charCode <= 122) { // a-z
          clAndroSocket.send(String.fromCharCode(charCode - 96));
        }
        setCtrlActive(false);
        return;
      }
      if (altActive && e.key.length === 1) {
        e.preventDefault();
        clAndroSocket.send("\u001b" + e.key);
        setAltActive(false);
        return;
      }
    }
  };

  const handleToolbarKey = (key: string) => {
    if (!clAndroSocket || clAndroSocket.readyState !== WebSocket.OPEN) return;

    if (key === "CTRL") {
      setCtrlActive(prev => !prev);
      return;
    }
    if (key === "ALT") {
      setAltActive(prev => !prev);
      return;
    }

    let code = "";
    switch (key) {
      case "ESC":
        code = "\u001b";
        break;
      case "TAB":
        code = "\t";
        break;
      case "HOME":
        code = "\u001b[H";
        break;
      case "END":
        code = "\u001b[F";
        break;
      case "UP":
        code = "\u001b[A";
        break;
      case "DOWN":
        code = "\u001b[B";
        break;
      case "LEFT":
        code = "\u001b[D";
        break;
      case "RIGHT":
        code = "\u001b[C";
        break;
      case "-":
        code = "-";
        break;
      case "/":
        code = "/";
        break;
      default:
        code = key;
    }

    if (code) {
      let finalCode = code;
      if (ctrlActive) {
        if (code.length === 1) {
          const charCode = code.toLowerCase().charCodeAt(0);
          if (charCode >= 97 && charCode <= 122) {
            finalCode = String.fromCharCode(charCode - 96);
          }
        }
        setCtrlActive(false);
      } else if (altActive) {
        if (code.length === 1) {
          finalCode = "\u001b" + code;
        }
        setAltActive(false);
      }
      clAndroSocket.send(finalCode);
    }
    
    // Maintain focus on the input field so keyboard remains open
    setTimeout(() => {
      terminalInputRef.current?.focus();
    }, 50);
  };

  // Recursive or nested file node renderer
  function FileNode({ item, depth }: { item: FileItem; depth: number }) {
    const isExpanded = expandedFolders.has(item.path);
    const isOpen = activeFile === item.path;
    const isModified = unsavedChanges.has(item.path);

    const handleClick = () => {
      if (item.isDir) {
        toggleFolder(item.path);
      } else {
        openFile(item.path);
      }
    };

    return (
      <div className="space-y-0.5 select-none">
        <div 
          onClick={handleClick}
          style={{ paddingLeft: `${depth * 10 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 px-2 hover:bg-slate-800/60 rounded-md cursor-pointer transition-all duration-150 ${
            isOpen ? "bg-sky-500/10 text-sky-400 font-semibold" : "text-slate-300 hover:text-white"
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {item.isDir ? (
              <ChevronRight className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-90 text-amber-400" : ""}`} />
            ) : null}
            {item.isDir ? (
              <Folder className={`h-3.5 w-3.5 shrink-0 ${isExpanded ? "text-amber-400 fill-amber-400/20" : "text-amber-500"}`} />
            ) : (
              <FileText className={`h-3.5 w-3.5 shrink-0 ${isOpen ? "text-sky-400" : "text-slate-400"}`} />
            )}
            <span className="text-xs truncate">{item.name}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.isDir ? (
              <button 
                onClick={(e) => { e.stopPropagation(); openCreateDialog("file", item.path); }} 
                title="New File"
                className="p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
              >
                <Plus className="h-3 w-3" />
              </button>
            ) : null}
            <button 
              onClick={(e) => { e.stopPropagation(); openDeleteDialog(item.path); }} 
              title="Delete"
              className="p-0.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            {isModified && (
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse ml-0.5 shrink-0" />
            )}
          </div>
        </div>
        {item.isDir && isExpanded && folderContents[item.path] && (
          <div className="space-y-0.5">
            {folderContents[item.path].map((child) => (
              <FileNode key={child.path} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isMarkdown = activeFile?.endsWith(".md") || activeFile?.endsWith(".markdown");

  return (
    <div 
      ref={containerRef}
      onScroll={handleContainerScroll}
      className="fixed bottom-0 left-0 right-0 overflow-hidden bg-slate-950 text-white flex flex-col font-sans select-none antialiased"
      style={{ top: "calc(3rem + env(safe-area-inset-top, 0px))" }}
    >
      
      {/* 1. TOP HEADER NAVIGATION */}
      <header className="h-12 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-bold transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>App</span>
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-sky-400 shrink-0" />
            <h1 className="font-bold text-sm tracking-tight hidden sm:block">Git Workspace</h1>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setMode("local")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all duration-200 flex items-center gap-1 cursor-pointer ${
              mode === "local" 
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" 
                : "text-slate-400 hover:text-white border border-transparent"
            }`}
          >
            <HardDrive className="h-3 w-3" />
            <span>Local Disk</span>
          </button>
          <button
            onClick={() => setMode("github")}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all duration-200 flex items-center gap-1 cursor-pointer ${
              mode === "github" 
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" 
                : "text-slate-400 hover:text-white border border-transparent"
            }`}
          >
            <Github className="h-3 w-3" />
            <span>GitHub Remotes</span>
          </button>
        </div>

        {/* Active file saving indicator */}
        <div className="flex items-center gap-2">

          {activeFile && (
            <button
              onClick={saveFile}
              disabled={isFileLoading}
              className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(56,189,248,0.25)] active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isFileLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Save</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN LAYOUT */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        
        {/* SIDEBAR TABS BAR */}
        <div className="w-11 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 gap-5 shrink-0">
          <button
            onClick={() => {
              setSidebarTab("explorer");
              setIsSidebarCollapsed(false);
            }}
            title="File Explorer"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              sidebarTab === "explorer" && !isSidebarCollapsed ? "text-sky-400 bg-slate-800/80" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Folder className="h-5 w-5" />
          </button>

          {mode === "local" && (
            <button
              onClick={() => {
                setSidebarTab("terminal");
                setIsSidebarCollapsed(true);
                setShowConsole(false);
                if (!clAndroSocket) {
                  connectToClAndro();
                }
              }}
              title="Cl-Andro Terminal"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                sidebarTab === "terminal" ? "text-sky-400 bg-slate-800/80" : "text-slate-500 hover:text-sky-350"
              }`}
            >
              <Terminal className="h-5 w-5" />
            </button>
          )}

          {mode === "local" && (
            <button
              onClick={() => {
                setSidebarTab("git");
                setIsSidebarCollapsed(false);
              }}
              title="Git Control"
              className={`p-2 rounded-lg transition-colors cursor-pointer relative ${
                sidebarTab === "git" && !isSidebarCollapsed ? "text-sky-400 bg-slate-800/80" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <GitBranch className="h-5 w-5" />
              {gitChanges.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-slate-900" />
              )}
            </button>
          )}
          {mode === "local" && (
            <button
              onClick={() => {
                setSidebarTab("siblings");
                setIsSidebarCollapsed(false);
              }}
              title="Sibling Projects"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                sidebarTab === "siblings" && !isSidebarCollapsed ? "text-sky-400 bg-slate-800/80" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <HardDrive className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Sidebar Slide-open handle */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="w-4 hover:w-5 bg-slate-900/40 border-r border-slate-800 hover:bg-slate-800 text-slate-500 hover:text-white flex items-center justify-center transition-all duration-150 cursor-pointer shrink-0 z-30 group"
            title="Open Sidebar"
          >
            <ChevronRight className="h-4 w-4 transition-transform group-hover:scale-110" />
          </button>
        )}

        {/* SIDEBAR CONTENT PANEL */}
        {!isSidebarCollapsed && (
          <div className="w-64 bg-slate-900/30 border-r border-slate-800 flex flex-col min-h-0 shrink-0 overflow-hidden">
          
          {/* Sibling/Repo Selector */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/10 shrink-0">
            {mode === "local" ? (
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Local Workspace</label>
                <select
                  value={currentProject}
                  onChange={(e) => setCurrentProject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg text-xs p-2 text-white outline-none focus:border-sky-500 transition-colors cursor-pointer"
                >
                  <option value="">Root Workspace (.android)</option>
                  {projects.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">GitHub Repo</label>
                {githubToken ? (
                  <select
                    value={currentRepo}
                    onChange={(e) => setCurrentRepo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg text-xs p-2 text-white outline-none focus:border-sky-500 transition-colors cursor-pointer"
                  >
                    {repos.map((r) => (
                      <option key={r.id} value={r.full_name}>
                        {r.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-2 border border-slate-800 rounded bg-slate-950 text-center">
                    <p className="text-[10px] text-slate-400">Log in to view repos</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tab Contents */}
          <div 
            className="flex-1 overflow-y-auto p-2 overscroll-contain touch-pan-y"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            
            {/* EXPLORER TAB */}
            {sidebarTab === "explorer" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Workspace Files</span>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => openCreateDialog("file")}
                      title="New File"
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => openCreateDialog("folder")}
                      title="New Folder"
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => mode === "local" ? loadLocalDirectory(currentProject, true) : loadGitHubDirectory("", true)}
                      title="Refresh Tree"
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isTreeLoading ? (
                  <div className="py-8 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-sky-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {rootFiles.map((file) => (
                      <FileNode key={file.path} item={file} depth={0} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SOURCE CONTROL TAB */}
            {sidebarTab === "git" && mode === "local" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1 border-b border-slate-800 pb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <GitBranch className="h-3.5 w-3.5 text-sky-400" />
                    Branch: {gitBranch}
                  </span>
                  <button
                    onClick={() => runLocalGitCommand("pull")}
                    disabled={isGitActionLoading}
                    title="Pull latest"
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-sky-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Changed Files */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">Changed Files ({gitChanges.length})</h4>
                  {gitChanges.length === 0 ? (
                    <p className="text-xs text-slate-500 italic px-1">No unstaged changes</p>
                  ) : (
                    <div className="space-y-1">
                      {gitChanges.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-1.5 hover:bg-slate-900/60 rounded">
                          <span className="truncate text-slate-300 pr-2">{file.path}</span>
                          <span className={`text-[9px] font-bold px-1 rounded shrink-0 ${
                            file.code === "M" ? "bg-amber-500/20 text-amber-400" :
                            file.code === "??" ? "bg-emerald-500/20 text-emerald-400" : "bg-sky-500/20 text-sky-400"
                          }`}>
                            {file.code === "??" ? "A" : file.code}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Commit Form */}
                <div className="space-y-2 border-t border-slate-850 pt-3">
                  <textarea
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Commit message..."
                    rows={3}
                    onFocus={handleInputFocus}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg text-xs p-2 text-white outline-none focus:border-sky-500 transition-colors resize-none placeholder-slate-600"
                  />
                  <button
                    onClick={() => runLocalGitCommand("commit-push")}
                    disabled={isGitActionLoading || gitChanges.length === 0}
                    className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs py-2 rounded-lg transition-all shadow-sm cursor-pointer disabled:shadow-none flex items-center justify-center gap-1.5"
                  >
                    {isGitActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCommit className="h-3.5 w-3.5" />}
                    <span>Commit & Push</span>
                  </button>
                </div>
              </div>
            )}

            {/* SIBLINGS LIST TAB */}
            {sidebarTab === "siblings" && mode === "local" && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 block mb-2">Projects in Sibling Directory</span>
                <div className="space-y-1">
                  {projects.map((proj) => (
                    <button
                      key={proj.name}
                      onClick={() => setCurrentProject(proj.name)}
                      className={`w-full text-left text-xs py-2 px-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                        currentProject === proj.name 
                          ? "bg-sky-500/10 text-sky-400 font-semibold" 
                          : "text-slate-400 hover:text-white hover:bg-slate-900/60"
                      }`}
                    >
                      <span>{proj.name}</span>
                      {currentProject === proj.name && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
        )}

        {/* WORKSPACE CONTENT AREA (Tabs + Editor + Preview) OR Full-screen Terminal */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
          {sidebarTab === "terminal" ? (
            // Full Screen Terminal
            <div 
              onClick={() => terminalInputRef.current?.focus()}
              className="flex-1 flex flex-col min-h-0 bg-slate-950 font-mono text-xs select-text cursor-text"
            >
              <div className="h-10 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between px-4 shrink-0 select-none">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cl-Andro Terminal</span>
                  <span className={`h-2 w-2 rounded-full ${clAndroSocket ? "bg-emerald-400 animate-pulse" : "bg-red-500"}`} />
                  <span className="text-[10px] text-slate-500">
                    {clAndroSocket ? "Linked & Active" : "Disconnected from Cl-Andro"}
                  </span>
                </div>
                {!clAndroSocket && (
                  <button
                    onClick={() => connectToClAndro()}
                    className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 cursor-pointer"
                  >
                    Link Terminal
                  </button>
                )}
              </div>
              
              {/* Terminal Logs stream */}
              <div 
                ref={terminalScrollRef}
                className="flex-1 overflow-y-auto pt-4 px-4 pb-6 leading-relaxed text-slate-300 space-y-1 font-mono text-[12px] bg-slate-950 overscroll-contain touch-pan-y"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {terminalLines.map((log, idx) => {
                  const isLast = idx === terminalLines.length - 1;
                  const match = log.match(/^(.*[\$#>])\s*$/);
                  const isPrompt = isLast && !!match;
                  
                  if (isPrompt) return null;
                  return (
                    <div key={idx} className="whitespace-pre-wrap min-h-[1.2em]">{log}</div>
                  );
                })}
                
                {mode === "local" && (
                  <form
                    onSubmit={handleTerminalSubmit}
                    className="flex items-center flex-wrap min-h-[1.2em] font-mono text-xs w-full mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(() => {
                      const lastLine = terminalLines[terminalLines.length - 1];
                      const match = lastLine?.match(/^(.*[\$#>])\s*$/);
                      const promptText = match ? match[1] + " " : "$ ";
                      return (
                        <span className="text-sky-400 font-bold shrink-0">{promptText}</span>
                      );
                    })()}
                    <input
                      ref={terminalInputRef}
                      type="text"
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      disabled={isTerminalRunning}
                      onFocus={handleTerminalFocus}
                      onKeyDown={handleTerminalKeyDown}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="flex-1 min-w-[100px] bg-transparent text-slate-200 focus:outline-none caret-sky-400 border-none outline-none p-0 font-mono text-[12px]"
                    />
                    <button type="submit" className="hidden" />
                  </form>
                )}
                <div ref={terminalEndRef} />
              </div>

              {/* Accessible Keyboard Toolbar (Termux style) */}
              {clAndroSocket && (
                <div className="h-10 border-t border-slate-900 bg-slate-950 flex items-center justify-between px-1 shrink-0 select-none gap-0.5">
                  {[
                    { label: "ESC", value: "ESC" },
                    { label: "TAB", value: "TAB" },
                    { label: "CTRL", value: "CTRL", active: ctrlActive },
                    { label: "ALT", value: "ALT", active: altActive },
                    { label: "-", value: "-" },
                    { label: "/", value: "/" },
                    { label: "HOME", value: "HOME" },
                    { label: "END", value: "END" },
                    { label: "←", value: "LEFT" },
                    { label: "↑", value: "UP" },
                    { label: "↓", value: "DOWN" },
                    { label: "→", value: "RIGHT" }
                  ].map((btn) => (
                    <button
                      key={btn.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToolbarKey(btn.value);
                      }}
                      className={`flex-1 py-1.5 rounded text-[10px] font-bold font-mono transition-all uppercase tracking-wider cursor-pointer border ${
                        btn.active
                          ? "bg-sky-500/20 text-sky-400 border-sky-500/30 font-extrabold shadow-[0_0_8px_rgba(14,165,233,0.15)]"
                          : "bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-white border-slate-850"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Tab Bar */}
              <div className="h-9 border-b border-slate-900 bg-slate-900/20 flex items-center px-2 gap-1 overflow-x-auto shrink-0 scrollbar-none select-none">
                {openFiles.length === 0 ? (
                  <span className="text-[10px] text-slate-500 px-3 italic font-sans select-none">No files open</span>
                ) : (
                  openFiles.map((filePath) => {
                    const isActive = activeFile === filePath;
                    const isModified = unsavedChanges.has(filePath);
                    return (
                      <div
                        key={filePath}
                        onClick={() => openFile(filePath)}
                        className={`h-7 px-3 flex items-center gap-2 rounded-t-lg text-xs cursor-pointer border-t-2 transition-all ${
                          isActive 
                            ? "bg-slate-900/80 border-sky-400 text-white font-semibold" 
                            : "border-transparent text-slate-500 hover:bg-slate-900/40 hover:text-slate-300"
                        }`}
                      >
                        <span className="truncate max-w-[120px] font-sans">{getBasename(filePath)}</span>
                        {isModified && (
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0" />
                        )}
                        <button
                          onClick={(e) => closeFile(filePath, e)}
                          className="p-0.5 rounded-md hover:bg-slate-800 text-slate-600 hover:text-white transition-colors"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Workspace Body */}
              <div className="flex-1 flex min-h-0 relative">
                {activeFile ? (
                  <div className="flex-1 flex min-h-0">
                    {/* Text Editor */}
                    <div className="flex-1 flex flex-col min-w-0 relative">
                      {/* Editor Sub-header Bar */}
                      <div className="h-9 border-b border-slate-900 bg-slate-950/40 flex items-center justify-between px-3 shrink-0 select-none">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => closeFile(activeFile, e)}
                            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Close File"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <span className="text-xs font-semibold text-slate-300 font-mono truncate" title={activeFile}>
                            {getBasename(activeFile)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {isMarkdown && (
                            <button
                              onClick={() => setShowPreview(!showPreview)}
                              className="text-slate-400 hover:text-white font-bold text-[10px] uppercase tracking-wide flex items-center gap-1 transition-colors cursor-pointer bg-slate-900/60 border border-slate-800/80 px-2.5 py-1 rounded-md hover:bg-slate-800"
                            >
                              {showPreview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              <span>{showPreview ? "Hide Preview" : "Split Preview"}</span>
                            </button>
                          )}
                          
                          {mode === "local" && (
                            <button
                              onClick={() => {
                                fetch("/api/workspace/local", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ action: "open-in-editor", path: activeFile }),
                                }).catch((err) => console.error("Failed to launch cluster-files editor:", err));
                              }}
                              className="text-sky-400 hover:text-sky-300 font-bold text-[10px] uppercase tracking-wide flex items-center gap-1 transition-colors cursor-pointer bg-slate-900/60 border border-slate-800/80 px-2.5 py-1 rounded-md hover:bg-slate-800"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Open with cl-files</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Code input textarea */}
                      <textarea
                        ref={textareaRef}
                        value={editorContent}
                        onChange={handleEditorChange}
                        onKeyDown={handleTabKey}
                        onDoubleClick={handleEditorDoubleClick}
                        onFocus={handleInputFocus}
                        className="flex-1 w-full p-4 bg-slate-950 text-slate-200 outline-none resize-none font-mono text-sm leading-relaxed border-none focus:ring-0 select-text overscroll-contain overflow-y-auto touch-pan-y"
                        style={{ WebkitOverflowScrolling: "touch" }}
                        spellCheck={false}
                      />
                    </div>

                    {/* Markdown Split View Preview */}
                    {isMarkdown && showPreview && (
                      <div 
                        className="w-1/2 border-l border-slate-850 bg-slate-900/20 overflow-y-auto p-5 select-text overscroll-contain touch-pan-y" 
                        style={{ WebkitOverflowScrolling: "touch" }}
                        onDoubleClick={handleEditorDoubleClick}
                      >
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">Markdown Preview</h3>
                        <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-300">
                          <MarkdownViewer content={editorContent} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 font-sans" onDoubleClick={handleEditorDoubleClick}>
                    <div className="max-w-md space-y-4">
                      <div className="bg-slate-900/40 p-4 rounded-full w-fit mx-auto border border-slate-850/60 text-slate-400">
                        <Code2 className="h-10 w-10 shrink-0" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-300">Developer Workspace</h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Select a file from the explorer list to begin editing. You can commit and push changes directly back to your GitHub repository or disk.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Console / Terminal logs */}
          {showConsole && sidebarTab !== "terminal" && (
            <div className="h-56 border-t border-slate-900 bg-slate-950 flex flex-col shrink-0">
              <div className="h-8 border-b border-slate-900 bg-slate-900/40 flex items-center justify-between px-3 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Terminal className="h-3.5 w-3.5 text-sky-400" />
                  Console / Terminal ({mode === "local" ? (currentProject ? `./${currentProject}` : "./.android") : "GitHub"})
                </span>
                <button
                  onClick={() => setShowConsole(false)}
                  className="text-slate-500 hover:text-white cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div 
                className="flex-1 overflow-y-auto p-3 font-mono text-[10px] leading-relaxed text-slate-400 space-y-1 select-text overscroll-contain touch-pan-y"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {consoleLogs.length === 0 ? (
                  <p className="text-slate-600 italic">No output logged yet. Run git commands, save files, or type a shell command below.</p>
                ) : (
                  consoleLogs.map((log, idx) => (
                    <div key={idx} className="whitespace-pre-wrap">{log}</div>
                  ))
                )}
              </div>
              {mode === "local" && (
                <form
                  onSubmit={handleTerminalSubmit}
                  className="h-8 border-t border-slate-900 bg-slate-950 flex items-center px-3 gap-2 shrink-0 font-mono text-[10px]"
                >
                  <span className="text-sky-400 font-bold">$</span>
                  <input
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    disabled={isTerminalRunning}
                    onFocus={handleInputFocus}
                    onKeyDown={handleTerminalKeyDown}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={isTerminalRunning ? "Running command..." : "Type shell command (e.g. git status, npm run build) and press Enter..."}
                    className="flex-1 bg-transparent text-slate-300 focus:outline-none placeholder-slate-700"
                  />
                  <button type="submit" className="hidden" />
                  {isTerminalRunning && (
                    <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
                  )}
                </form>
              )}
            </div>
          )}

          {/* Status Bar */}
          <footer className="h-6 border-t border-slate-900 bg-slate-900/80 flex items-center justify-between px-3 text-[10px] text-slate-500 shrink-0 select-none">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 uppercase font-bold text-slate-400">
                <span className={`h-1.5 w-1.5 rounded-full ${mode === "local" ? "bg-sky-400" : "bg-emerald-400"}`} />
                {mode === "local" ? "Local Disk" : "GitHub Mode"}
              </span>
              <span>Project: <strong className="text-slate-400">{mode === "local" ? currentProject : currentRepo}</strong></span>
              {mode === "local" && (
                <span className="flex items-center gap-1 font-mono">
                  <GitBranch className="h-3 w-3" />
                  {gitBranch}
                </span>
              )}
            </div>
            <div>
              {activeFile && (
                <span>
                  Length: <strong className="text-slate-400">{editorContent.length}</strong> chars
                </span>
              )}
            </div>
          </footer>

        </div>

      </div>

      {/* 3. DIALOG OVERLAY (File/Folder Creation/Deletion Modal) */}
      {dialogState?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setDialogState(null)} />
          <div className="relative bg-slate-900 border border-slate-800 w-full max-w-sm rounded-xl shadow-2xl p-5 overflow-hidden z-10 flex flex-col animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-sm text-white mb-4">
              {dialogState.type === "file" && "Create New File"}
              {dialogState.type === "folder" && "Create New Directory"}
              {dialogState.type === "delete" && "Delete Item"}
            </h3>

            <form onSubmit={handleDialogSubmit} className="space-y-4">
              {dialogState.type !== "delete" ? (
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Name</label>
                  <input
                    type="text"
                    value={dialogState.name}
                    onChange={(e) => setDialogState({ ...dialogState, name: e.target.value })}
                    placeholder={dialogState.type === "file" ? "index.js" : "new-folder"}
                    onFocus={handleInputFocus}
                    className="w-full text-xs px-3 py-2 border border-slate-800 bg-slate-950 rounded-lg text-white outline-none focus:border-sky-500"
                    autoFocus
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed">
                  Are you sure you want to delete <strong className="text-red-400 font-mono">{dialogState.name}</strong>? This action is permanent and cannot be undone.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDialogState(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-bold text-slate-950 rounded-lg transition-all active:scale-95 cursor-pointer ${
                    dialogState.type === "delete" 
                      ? "bg-red-500 hover:bg-red-400 text-white" 
                      : "bg-sky-500 hover:bg-sky-400"
                  }`}
                >
                  {dialogState.type === "delete" ? "Delete" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
