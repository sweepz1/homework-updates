import type { Handler } from "@netlify/functions";
import OpenAI from "openai";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { previousContent, currentContent } = JSON.parse(event.body || "{}");

  if (!previousContent || !currentContent) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "Missing content" }),
    };
  }

  const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY!,
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
Only include subjects that actually changed. Be concise.`,
        },
        {
          role: "user",
          content: `PREVIOUS VERSION:\n${previousContent}\n\n---\n\nCURRENT VERSION:\n${currentContent}`,
        },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, ...parsed }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        hasChanges: false,
        summary: "Unable to parse changes",
        subjects: [],
      }),
    };
  } catch (error) {
    console.error("DeepSeek error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to summarize",
      }),
    };
  }
};
