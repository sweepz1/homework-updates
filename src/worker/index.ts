import { Hono } from "hono";
import Firecrawl from "@mendable/firecrawl-js";
import OpenAI from "openai";

interface AppEnv extends Env {
  FIRECRAWL_API_KEY: string;
  DEEPSEEK_API_KEY: string;
}

const app = new Hono<{ Bindings: AppEnv }>();

const TARGET_URL = "https://sd41blogs.ca/smithc/weekly-assignments-submission-details/";

app.get("/api/assignments", async (c) => {
  const firecrawl = new Firecrawl({ apiKey: c.env.FIRECRAWL_API_KEY });

  try {
    const result = await firecrawl.scrape(TARGET_URL, {
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30000,
    });

    return c.json({
      success: true,
      content: result.markdown,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch page",
    }, 500);
  }
});

app.post("/api/summarize", async (c) => {
  const { previousContent, currentContent } = await c.req.json<{
    previousContent: string;
    currentContent: string;
  }>();

  if (!previousContent || !currentContent) {
    return c.json({ success: false, error: "Missing content" }, 400);
  }

  const deepseek = new OpenAI({
    apiKey: c.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });

  try {
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that summarizes changes to a school assignments page. 
Compare the previous and current versions and identify what changed.
Focus on: new assignments, changed due dates, removed items.
Format your response as JSON with this structure:
{
  "hasChanges": boolean,
  "summary": "Brief overall summary of changes",
  "subjects": [
    { "name": "Subject Name", "changes": ["change 1", "change 2"] }
  ]
}
Only include subjects that actually changed. Be concise.`
        },
        {
          role: "user",
          content: `PREVIOUS VERSION:\n${previousContent}\n\n---\n\nCURRENT VERSION:\n${currentContent}`
        }
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || "";
    
    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return c.json({ success: true, ...parsed });
    }

    return c.json({ 
      success: true, 
      hasChanges: false, 
      summary: "Unable to parse changes",
      subjects: [] 
    });
  } catch (error) {
    console.error("DeepSeek error:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to summarize",
    }, 500);
  }
});

export default app;
