import type { VercelRequest, VercelResponse } from "@vercel/node";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!DEEPSEEK_API_KEY) {
    return res.status(200).json({ summary: "" });
  }

  const { assignments } = req.body;
  if (!assignments || !Array.isArray(assignments)) {
    return res.status(400).json({ error: "Missing assignments" });
  }

  const text = assignments
    .map((s: { subject: string; items: { text: string; urgent: boolean }[] }) =>
      `${s.subject}:\n${s.items.map(i => `- ${i.text}${i.urgent ? " [URGENT]" : ""}`).join("\n")}`
    )
    .join("\n\n");

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant summarizing a student's homework assignments. Be concise, friendly, and highlight anything urgent. Write 2-3 sentences max.",
          },
          {
            role: "user",
            content: `Here are the current assignments:\n\n${text}\n\nWrite a short summary for a student.`,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error(`DeepSeek error ${response.status}`);
    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() ?? "";
    return res.json({ summary });
  } catch (err) {
    console.error("DeepSeek error:", err);
    return res.status(200).json({ summary: "" });
  }
}
