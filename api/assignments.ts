import type { VercelRequest, VercelResponse } from "@vercel/node";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;
const CACHE_KEY = "hw:cache";
const SNAPSHOT_KEY = "hw:snapshot";
const CHANGES_KEY = "hw:changes";
const CACHE_TTL = 900;
const SOURCE_URL =
  "https://sd41blogs.ca/smithc/weekly-assignments-submission-details/";

async function redisGet(key: string) {
  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function redisSet(key: string, value: unknown, ttl?: number) {
  const url = ttl
    ? `${REDIS_URL}/set/${encodeURIComponent(key)}?ex=${ttl}`
    : `${REDIS_URL}/set/${encodeURIComponent(key)}`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(JSON.stringify(value)),
  });
}

function parseAssignments(html: string) {
  const subjectPattern =
    /<strong>([^<]{2,60}?)<\/strong>([\s\S]*?)(?=<strong>|<h2|$)/gi;
  const subjects: { subject: string; items: { text: string; urgent: boolean }[] }[] = [];
  const flags = ["overdue", "due", "monday", "friday", "permission", "payment", "needed", "must", "handed in"];

  let match;
  while ((match = subjectPattern.exec(html)) !== null) {
    const subject = match[1].trim().replace(/:$/, "");
    if (subject.length < 3 || subject.includes("<")) continue;

    const block = match[2]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, "$2 ($1)")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&nbsp;/g, " ")
      .replace(/\s{2,}/g, " ");

    const items = block
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 3)
      .map((text) => ({
        text,
        urgent: flags.some((f) => text.toLowerCase().includes(f)),
      }));

    if (items.length > 0) subjects.push({ subject, items });
  }
  return subjects;
}

function diffAssignments(
  prev: ReturnType<typeof parseAssignments>,
  curr: ReturnType<typeof parseAssignments>
) {
  const changes: { type: "added" | "removed" | "new_subject"; subject: string; text: string }[] = [];
  const prevMap = new Map(prev.map((s) => [s.subject, s.items.map((i) => i.text)]));
  const currMap = new Map(curr.map((s) => [s.subject, s.items.map((i) => i.text)]));

  for (const [subject, items] of currMap) {
    const prevItems = prevMap.get(subject) ?? [];
    if (prevItems.length === 0 && items.length > 0) {
      changes.push({ type: "new_subject", subject, text: `${items.length} item(s) added` });
    } else {
      for (const item of items) {
        if (!prevItems.includes(item)) changes.push({ type: "added", subject, text: item });
      }
      for (const item of prevItems) {
        if (!items.includes(item)) changes.push({ type: "removed", subject, text: item });
      }
    }
  }
  return changes;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  if (req.method === "OPTIONS") return res.status(200).end();

  const cached = await redisGet(CACHE_KEY);
  if (cached) return res.json({ ...cached, fromCache: true });

  try {
    const response = await fetch(SOURCE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HomeworkTracker/1.0)" },
    });
    if (!response.ok) throw new Error(`Upstream ${response.status}`);
    const html = await response.text();
    const assignments = parseAssignments(html);
    const lastUpdated = new Date().toISOString();

    const lastSnapshot = await redisGet(SNAPSHOT_KEY);
    let recentChanges = (await redisGet(CHANGES_KEY)) ?? [];

    if (lastSnapshot) {
      const diff = diffAssignments(lastSnapshot.assignments, assignments);
      if (diff.length > 0) {
        recentChanges = [
          { changes: diff, detectedAt: lastUpdated },
          ...recentChanges,
        ].slice(0, 10);
        await redisSet(CHANGES_KEY, recentChanges);
        await redisSet(SNAPSHOT_KEY, { assignments, savedAt: lastUpdated });
      }
    } else {
      await redisSet(SNAPSHOT_KEY, { assignments, savedAt: lastUpdated });
    }

    const safeHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/on\w+="[^"]*"/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "");

    const payload = { assignments, lastUpdated, recentChanges, safeHtml, fromCache: false };
    await redisSet(CACHE_KEY, payload, CACHE_TTL);
    return res.json(payload);
  } catch (err) {
    const snapshot = await redisGet(SNAPSHOT_KEY);
    if (snapshot) {
      return res.json({
        ...snapshot,
        fromCache: true,
        stale: true,
        recentChanges: (await redisGet(CHANGES_KEY)) ?? [],
        safeHtml: "",
      });
    }
    return res.status(500).json({ error: String(err) });
  }
}
