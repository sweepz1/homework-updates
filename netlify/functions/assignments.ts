import type { Handler } from "@netlify/functions";
import * as cheerio from "cheerio";

const TARGET_URL = "https://sd41blogs.ca/smithc/weekly-assignments-submission-details/";

export const handler: Handler = async () => {
  try {
    // 1. Fetch the raw HTML from the school blog
    const response = await fetch(TARGET_URL, {
      headers: {
        // Pretend to be a regular browser so the site doesn't block us
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // 2. Load the HTML into cheerio (like jQuery for Node.js)
    const $ = cheerio.load(html);

    // 3. Remove junk we don't want (nav, footer, sidebars, scripts)
    $("nav, footer, header, script, style, .sidebar, #sidebar, .widget, .wp-block-navigation").remove();

    // 4. Grab the main content area — WordPress blogs typically use .entry-content or .post-content
    const mainContent =
      $(".entry-content").text() ||
      $(".post-content").text() ||
      $("article").text() ||
      $("main").text() ||
      $("body").text();

    // 5. Clean up excessive whitespace so DeepSeek gets clean text
    const cleaned = mainContent
      .replace(/\t/g, " ")           // tabs → spaces
      .replace(/ {2,}/g, " ")        // multiple spaces → one
      .replace(/\n{3,}/g, "\n\n")    // 3+ newlines → 2
      .trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        content: cleaned,
        fetchedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Scrape error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch page",
      }),
    };
  }
};
