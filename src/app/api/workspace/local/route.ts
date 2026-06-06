import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

// Execute a command inside the cl-andro app directory on the phone via ADB
async function executePhoneCmd(cmd: string, relativePath: string = "") {
  const homePath = "/data/data/com.zk.clandro/files/home";
  
  // Clean relative path and resolve it safely using posix style
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\.\.+/g, "");
  const absolutePath = cleaned ? path.posix.join(homePath, cleaned) : homePath;
  
  const shellCmd = `cd "${absolutePath}" && ${cmd}`;
  const adbCmd = `adb shell "run-as com.zk.clandro env PREFIX=/data/data/com.zk.clandro/files/usr LD_LIBRARY_PATH=/data/data/com.zk.clandro/files/usr/lib PATH=/data/data/com.zk.clandro/files/usr/bin HOME=/data/data/com.zk.clandro/files/home /system/bin/sh -c '${shellCmd.replace(/'/g, "'\\''")}'"`;
  
  return execPromise(adbCmd);
}

// GET handler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const relPath = searchParams.get("path") || "";

  try {
    // 1. List sibling projects
    if (action === "list-projects") {
      try {
        const { stdout } = await executePhoneCmd("find . -maxdepth 1 -mindepth 1 -type d");
        const projects = stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "")
          .map((line) => {
            const name = line.replace(/^\.\//, "");
            return { name, path: name };
          });
        return NextResponse.json({ projects });
      } catch (err: any) {
        return NextResponse.json({ projects: [] });
      }
    }

    // 2. List files in directory (shallow list)
    if (action === "list-files") {
      try {
        const { stdout } = await executePhoneCmd("find . -maxdepth 1 -mindepth 1 -exec stat -c '%n|%F|%s' {} \\;", relPath);
        const items = stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "")
          .map((line) => {
            const parts = line.split("|");
            const rawPath = parts[0].replace(/^\.\//, "");
            const type = parts[1];
            const sizeStr = parts[2];
            
            const isDir = type.includes("directory");
            const itemRelPath = relPath ? `${relPath}/${rawPath}` : rawPath;
            
            return {
              name: rawPath,
              path: itemRelPath,
              isDir,
              size: isDir ? undefined : parseInt(sizeStr, 10),
              ext: isDir ? undefined : path.extname(rawPath).toLowerCase(),
            };
          });

        // Sort: folders first, then files alphabetically
        items.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.name.localeCompare(b.name);
        });

        return NextResponse.json({ items });
      } catch (err: any) {
        return NextResponse.json({ items: [] });
      }
    }

    // 3. Read file content
    if (action === "read-file") {
      try {
        const filename = path.posix.basename(relPath);
        const dirname = path.posix.dirname(relPath);
        const { stdout } = await executePhoneCmd(`cat "${filename}"`, dirname === "." ? "" : dirname);
        return NextResponse.json({ content: stdout });
      } catch (err: any) {
        return NextResponse.json({ error: "File not found or failed to read" }, { status: 404 });
      }
    }

    // 4. Git status for a project
    if (action === "git-status") {
      try {
        const { stdout: branchOut } = await executePhoneCmd("git rev-parse --abbrev-ref HEAD", relPath);
        const { stdout: statusOut } = await executePhoneCmd("git status -s", relPath);
        
        const files = statusOut
          .split("\n")
          .filter((line) => line.trim() !== "")
          .map((line) => {
            const code = line.substring(0, 2).trim();
            const filePath = line.substring(3).trim();
            return { code, path: filePath };
          });

        return NextResponse.json({
          branch: branchOut.trim(),
          files,
        });
      } catch (gitErr: any) {
        return NextResponse.json({ branch: "not-a-repo", files: [] });
      }
    }

    return NextResponse.json({ error: "Invalid GET action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// POST handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, path: relPath, content, type, command, commitMessage } = body;

    // 0. Open file in cluster-files editor on the phone
    if (action === "open-in-editor") {
      try {
        const homePath = "/data/data/com.zk.clandro/files/home";
        
        // Clean relative path and resolve it safely using posix style
        const cleaned = relPath.replace(/^\/+/, "").replace(/\.\.+/g, "");
        const absolutePath = cleaned ? path.posix.join(homePath, cleaned) : homePath;
        
        const ext = path.extname(cleaned).toLowerCase();
        let mimeType = "text/plain";
        if (ext === ".json") mimeType = "application/json";
        else if (ext === ".js" || ext === ".mjs") mimeType = "application/javascript";
        else if (ext === ".ts" || ext === ".tsx") mimeType = "application/typescript";
        else if (ext === ".xml") mimeType = "application/xml";
        else if (ext === ".yaml" || ext === ".yml") mimeType = "application/yaml";
        else if (ext === ".html") mimeType = "text/html";
        else if (ext === ".css") mimeType = "text/css";
        else if (ext === ".md") mimeType = "text/markdown";
        
        const adbCmd = `adb shell "am start -n com.zk.clfiles/com.zk.clfiles.viewer.text.TextEditorActivity -a android.intent.action.VIEW -d \\"file://${absolutePath}\\" -t \\"${mimeType}\\""`;
        await execPromise(adbCmd);
        
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to launch cluster-files editor" }, { status: 500 });
      }
    }

    // 1. Write file content
    if (action === "write-file") {
      try {
        // Write to temporary local file, push to phone, then copy using run-as
        const tempLocalFile = path.join("/tmp", `gs-${Date.now()}-${path.basename(relPath)}`);
        const tempPhoneFile = path.posix.join("/data/local/tmp", path.basename(tempLocalFile));
        
        const dirname = path.posix.dirname(relPath);
        if (dirname !== ".") {
          await executePhoneCmd(`mkdir -p "${dirname}"`);
        }

        fs.writeFileSync(tempLocalFile, content || "", "utf-8");
        
        await execPromise(`adb push "${tempLocalFile}" "${tempPhoneFile}"`);
        await executePhoneCmd(`cp "${tempPhoneFile}" "${relPath}"`);
        
        fs.unlinkSync(tempLocalFile);
        await execPromise(`adb shell rm "${tempPhoneFile}"`);
        
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to write file" }, { status: 500 });
      }
    }

    // 2. Create file/folder
    if (action === "create-item") {
      try {
        const dirname = path.posix.dirname(relPath);
        const basename = path.posix.basename(relPath);
        
        if (type === "directory") {
          await executePhoneCmd(`mkdir -p "${basename}"`, dirname === "." ? "" : dirname);
        } else {
          if (dirname !== ".") {
            await executePhoneCmd(`mkdir -p "${dirname}"`);
          }
          await executePhoneCmd(`touch "${basename}"`, dirname === "." ? "" : dirname);
        }
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to create item" }, { status: 500 });
      }
    }

    // 3. Delete file/folder
    if (action === "delete-item") {
      try {
        const dirname = path.posix.dirname(relPath);
        const basename = path.posix.basename(relPath);
        
        await executePhoneCmd(`rm -rf "${basename}"`, dirname === "." ? "" : dirname);
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to delete item" }, { status: 500 });
      }
    }

    // 4. Git action (pull, commit/push)
    if (action === "git-action") {
      try {
        if (command === "pull") {
          const { stdout, stderr } = await executePhoneCmd("git pull", relPath);
          return NextResponse.json({ stdout, stderr });
        }

        if (command === "commit-push") {
          if (!commitMessage || commitMessage.trim() === "") {
            return NextResponse.json({ error: "Commit message required" }, { status: 400 });
          }
          const addRes = await executePhoneCmd("git add .", relPath);
          const commitRes = await executePhoneCmd(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, relPath);
          const pushRes = await executePhoneCmd("git push", relPath);
          
          return NextResponse.json({
            stdout: `${addRes.stdout}\n${commitRes.stdout}\n${pushRes.stdout}`,
            stderr: `${addRes.stderr}\n${commitRes.stderr}\n${pushRes.stderr}`,
          });
        }
        return NextResponse.json({ error: "Invalid git command" }, { status: 400 });
      } catch (err: any) {
        return NextResponse.json({ stdout: err.stdout || "", stderr: err.stderr || err.message || "Git action failed" }, { status: 400 });
      }
    }

    // 5. Run command in project directory
    if (action === "run-command") {
      if (!command || command.trim() === "") {
        return NextResponse.json({ error: "Command required" }, { status: 400 });
      }

      try {
        const { stdout, stderr } = await executePhoneCmd(command, relPath);
        return NextResponse.json({ stdout, stderr });
      } catch (cmdErr: any) {
        return NextResponse.json({
          stdout: cmdErr.stdout || "",
          stderr: cmdErr.stderr || cmdErr.message || "Command execution failed",
        }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Invalid POST action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
