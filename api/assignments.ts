import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as cheerio from "cheerio";

const TARGET_URL = "https://sd41blogs.ca/smithc/weekly-assignments-submission-details/";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(TARGET_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $("nav, footer, header, script, style, .sidebar, #sidebar, .widget, .wp-block-navigation").remove();

    const mainContent =
      $(".entry-content").text() ||
      $(".post-content").text() ||
      $("article").text() ||
      $("main").text() ||
      $("body").text();

    const cleaned = mainContent
      .replace(/\t/g, " ")
      .replace(/ {2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return res.json({
      success: true,
      content: cleaned,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch page",
    });
  }
}
