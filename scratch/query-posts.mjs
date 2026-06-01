import fs from "fs";

// Polyfill global WebSocket for Supabase Client initialization in Node < 22
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class {};
}

import { createClient } from "@supabase/supabase-js";


// Load environment variables from .env.local
const loadEnv = () => {
  try {
    const envFile = fs.readFileSync(".env.local", "utf-8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch (err) {
    console.warn("Could not read .env.local file.");
  }
};

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: posts, error } = await supabase
    .from("social_posts")
    .select("*");
  if (error) {
    console.error("Error fetching posts:", error);
  } else {
    console.log("Staging posts in DB:", posts);
  }
}

run();
