import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Mock WebSocket constructor for Supabase Realtime in older Node.js versions
global.WebSocket = class {};

// Load env vars manually to avoid package dependency
const envFile = fs.readFileSync(".env.local", "utf8");
const lines = envFile.split("\n");
let supabaseUrl = "";
let supabaseServiceKey = "";

for (const line of lines) {
  const cleanLine = line.trim();
  if (cleanLine.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = cleanLine.split("=")[1].trim().replace(/['"]/g, "");
  }
  if (cleanLine.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    supabaseServiceKey = cleanLine.split("=")[1].trim().replace(/['"]/g, "");
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data, error } = await supabase
    .from("developers")
    .select("github_login, github_token, claimed")
    .eq("github_login", "zk-alamgir")
    .maybeSingle();

  if (error) {
    console.error("Error: ", error);
  } else {
    console.log("Developer Record: ", {
      github_login: data?.github_login,
      has_token: !!data?.github_token,
      token_preview: data?.github_token ? data.github_token.substring(0, 10) + "..." : null,
      claimed: data?.claimed
    });
  }
}

run();
