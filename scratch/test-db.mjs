import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load env
const envFile = fs.readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [key, ...rest] = trimmed.split("=");
  if (key && rest.length) {
    process.env[key.trim()] = rest.join("=").trim();
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing insert...");
  // 1. Insert test post
  const { data: post, error: insertError } = await supabase
    .from("social_posts")
    .insert({
      developer_id: 1, // Assumes developer 1 exists, let's see
      content: "Test post from scratch script",
    })
    .select("id, content, created_at")
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return;
  }
  console.log("Inserted post:", post);

  console.log("Testing update...");
  // 2. Update post
  const { data: updated, error: updateError } = await supabase
    .from("social_posts")
    .update({
      github_issue_number: 9999,
      user_synced: true,
    })
    .eq("id", post.id)
    .select();

  if (updateError) {
    console.error("Update error:", updateError);
  } else {
    console.log("Updated post successfully:", updated);
  }

  // Cleanup
  console.log("Testing delete...");
  const { error: deleteError } = await supabase
    .from("social_posts")
    .delete()
    .eq("id", post.id);
  if (deleteError) {
    console.error("Delete error:", deleteError);
  } else {
    console.log("Deleted test post successfully.");
  }
}

test();
