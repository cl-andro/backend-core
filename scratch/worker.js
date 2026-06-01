const GITHUB_ORG = "cl-andro";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cache = caches.default;
    
    // Check if cache has this request
    let response = await cache.match(request);
    if (response) {
      return response;
    }

    let targetUrl = "";
    
    // Parse paths:
    // /global?page=X -> maps to raw.githubusercontent.com/cl-andro/feed/main/home_X.json
    // /user/username?page=X -> maps to raw.githubusercontent.com/cl-andro/social-username/main/feed_X.json
    if (url.pathname === "/global") {
      const page = url.searchParams.get("page") || "0";
      const recommended = url.searchParams.get("recommended") === "true";
      if (recommended) {
        targetUrl = `https://raw.githubusercontent.com/${GITHUB_ORG}/feed/main/recommended_${page}.json`;
      } else {
        targetUrl = `https://raw.githubusercontent.com/${GITHUB_ORG}/feed/main/home_${page}.json`;
      }
    } else if (url.pathname.startsWith("/user/")) {
      const username = url.pathname.substring(6); // remove "/user/"
      const page = url.searchParams.get("page") || "0";
      targetUrl = `https://raw.githubusercontent.com/${GITHUB_ORG}/social-${username}/main/feed_${page}.json`;
    } else {
      return new Response("Not Found", { status: 404 });
    }

    try {
      const res = await fetch(targetUrl, {
        headers: { "User-Agent": "cloudflare-worker-feed" }
      });

      if (!res.ok) {
        return new Response(JSON.stringify([]), {
          status: 200, // Return empty array on missing pages
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
          }
        });
      }

      const data = await res.json();
      
      // Create response with CORS and cache headers
      response = new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "public, max-age=60", // Cache at edge/browser for 1 minute
        }
      });

      // Cache the response
      ctx.waitUntil(cache.put(request, response.clone()));
      return response;
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
