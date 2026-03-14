import { useEffect, useState, useCallback, useRef } from "react";

interface AssignmentItem {
  text: string;
  urgent: boolean;
}
interface SubjectBlock {
  subject: string;
  items: AssignmentItem[];
}
interface ChangeEvent {
  detectedAt: string;
  changes: { type: "added" | "removed" | "new_subject"; subject: string; text: string }[];
}
interface ApiResponse {
  assignments: SubjectBlock[];
  lastUpdated: string;
  recentChanges: ChangeEvent[];
  safeHtml: string;
  fromCache: boolean;
  stale?: boolean;
  error?: string;
}

type Tab = "summary" | "live" | "changes";

const SUBJECT_COLORS: Record<string, string> = {
  "Language Arts": "#185FA5",
  Math: "#3B6D11",
  Science: "#534AB7",
  "Social Studies": "#993556",
  French: "#993C1D",
  Art: "#BA7517",
  ADST: "#BA7517",
  Physical: "#0F6E56",
  Career: "#5F5E5A",
  Music: "#7F77DD",
  Other: "#5F5E5A",
};

function getAccent(subject: string) {
  for (const [key, color] of Object.entries(SUBJECT_COLORS)) {
    if (subject.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "#888780";
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
      padding: "2px 7px", borderRadius: 99,
      background: color + "18", color,
      border: `1px solid ${color}30`,
    }}>{children}</span>
  );
}

export default function HomePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assignments");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json: ApiResponse = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Write safe HTML into iframe
  useEffect(() => {
    if (tab === "live" && data?.safeHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`<!DOCTYPE html><html><head>
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <style>
            body { font-family: system-ui, sans-serif; font-size: 15px; line-height: 1.6;
                   color: #1a1a18; padding: 20px 24px; max-width: 700px; margin: 0 auto; }
            img { max-width: 100%; height: auto; border-radius: 8px; }
            a { color: #185FA5; }
            h1,h2,h3 { font-weight: 600; margin: 1.2em 0 0.4em; }
            p { margin: 0.5em 0; }
            strong { font-weight: 600; }
            ul,ol { padding-left: 1.4em; }
            .sidebar, .widget, .navigation, #sidebar, .nav, header, footer, nav { display: none !important; }
          </style>
        </head><body>${data.safeHtml}</body></html>`);
        doc.close();
      }
    }
  }, [tab, data?.safeHtml]);

  const urgentItems = data?.assignments?.flatMap(s =>
    s.items.filter(i => i.urgent).map(i => ({ ...i, subject: s.subject }))
  ) ?? [];

  const filtered = search.trim()
    ? data?.assignments.map(s => ({
        ...s,
        items: s.items.filter(i => i.text.toLowerCase().includes(search.toLowerCase())),
      })).filter(s => s.items.length > 0)
    : data?.assignments;

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: tab === t ? 500 : 400,
    color: tab === t ? "#1a1a18" : "#888780",
    background: "none",
    border: "none",
    borderBottom: tab === t ? "2px solid #1a1a18" : "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%,100%{opacity:0.5} 50%{opacity:1} }
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(250,250,248,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid #E8E6DF",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#1a1a18", letterSpacing: "-0.2px" }}>
                Assignment Pulse
              </div>
              <div style={{ fontSize: 11, color: "#B4B2A9", marginTop: 1 }}>
                {data ? (
                  <>
                    {data.stale ? "⚠ stale · " : data.fromCache ? "cached · " : "live · "}
                    {timeAgo(data.lastUpdated)}
                    {tick > -1 ? "" : ""}
                  </>
                ) : "Loading..."}
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "#1a1a18", color: "#fff",
                border: "none", borderRadius: 7,
                padding: "7px 12px", fontSize: 12, fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.55 : 1,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
                style={{ animation: loading ? "spin 1s linear infinite" : "none" }}>
                <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.8 0 3.4.87 4.4 2.2"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                <path d="M13.5 2.5v2.5H11"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {loading ? "Checking…" : "Refresh"}
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0 }}>
            <button style={tabStyle("summary")} onClick={() => setTab("summary")}>Summary</button>
            <button style={tabStyle("live")} onClick={() => setTab("live")}>Live Page</button>
            <button style={tabStyle("changes")} onClick={() => setTab("changes")}>
              Changes
              {data?.recentChanges.length ? (
                <span style={{
                  marginLeft: 5, fontSize: 10, fontWeight: 600,
                  background: "#1a1a18", color: "#fff",
                  padding: "1px 5px", borderRadius: 99,
                }}>{data.recentChanges.length}</span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 60px" }}>
        {error && (
          <div style={{
            background: "#FCEBEB", color: "#A32D2D",
            border: "1px solid #F7C1C1", borderRadius: 10,
            padding: "12px 16px", marginBottom: 16, fontSize: 13,
          }}>
            {error} —{" "}
            <button onClick={fetchData} style={{ background: "none", border: "none", color: "inherit", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
              Retry
            </button>
          </div>
        )}

        {/* SUMMARY TAB */}
        {tab === "summary" && (
          <div style={{ animation: "fadeUp 0.25s ease" }}>

            {/* Urgent banner */}
            {urgentItems.length > 0 && (
              <div style={{
                background: "#fff8ed",
                border: "1px solid #F5C4B3",
                borderRadius: 10, padding: "14px 16px", marginBottom: 20,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#993C1D", marginBottom: 8, letterSpacing: "0.05em" }}>
                  NEEDS ATTENTION · {urgentItems.length} item{urgentItems.length !== 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {urgentItems.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <Pill color={getAccent(item.subject)}>{item.subject}</Pill>
                      <span style={{ fontSize: 13, color: "#633806" }}>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search */}
            {data && (
              <div style={{ position: "relative", marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                  style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#B4B2A9" }}>
                  <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search assignments…"
                  style={{
                    width: "100%", padding: "8px 12px 8px 32px",
                    fontSize: 13, border: "1px solid #E8E6DF", borderRadius: 8,
                    background: "#fff", color: "#1a1a18", outline: "none",
                  }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "#B4B2A9", cursor: "pointer", fontSize: 16, lineHeight: 1,
                  }}>×</button>
                )}
              </div>
            )}

            {/* Skeleton */}
            {loading && !data && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ background: "#fff", borderRadius: 10, border: "1px solid #E8E6DF", padding: "14px 16px", animation: "shimmer 1.4s ease infinite", animationDelay: `${i*100}ms` }}>
                    <div style={{ height: 12, width: "25%", background: "#E8E6DF", borderRadius: 4, marginBottom: 10 }} />
                    <div style={{ height: 11, width: "75%", background: "#F1EFE8", borderRadius: 4, marginBottom: 6 }} />
                    <div style={{ height: 11, width: "55%", background: "#F1EFE8", borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {data && filtered?.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#B4B2A9" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>—</div>
                <div style={{ fontSize: 14 }}>{search ? "No matches found" : "Nothing posted yet"}</div>
              </div>
            )}

            {/* Subject cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered?.map((block, i) => {
                const accent = getAccent(block.subject);
                return (
                  <div key={block.subject} style={{
                    background: "#fff",
                    border: "1px solid #E8E6DF",
                    borderRadius: 10,
                    overflow: "hidden",
                    animation: `fadeUp 0.25s ease both`,
                    animationDelay: `${i * 35}ms`,
                  }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "10px 14px",
                      borderBottom: "1px solid #F1EFE8",
                      borderLeft: `3px solid ${accent}`,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: accent, letterSpacing: "0.02em" }}>
                        {block.subject.toUpperCase()}
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#B4B2A9" }}>
                        {block.items.length} item{block.items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div>
                      {block.items.map((item, j) => (
                        <div key={j} style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "9px 14px",
                          borderBottom: j < block.items.length - 1 ? "1px solid #F7F6F2" : "none",
                          background: item.urgent ? "#fffcf5" : "transparent",
                        }}>
                          <div style={{
                            width: 4, height: 4, borderRadius: "50%", flexShrink: 0,
                            background: item.urgent ? "#BA7517" : "#D3D1C7",
                            marginTop: 7,
                          }} />
                          <span style={{
                            fontSize: 13, lineHeight: 1.55,
                            color: item.urgent ? "#4A2800" : "#2c2c2a",
                            fontWeight: item.urgent ? 500 : 400,
                          }}>
                            {item.text}
                            {item.urgent && (
                              <span style={{
                                marginLeft: 6, fontSize: 9, fontWeight: 700,
                                background: "#FAEEDA", color: "#BA7517",
                                padding: "1px 5px", borderRadius: 4,
                                verticalAlign: "middle", letterSpacing: "0.05em",
                              }}>URGENT</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {data && (
              <p style={{ fontSize: 11, color: "#D3D1C7", textAlign: "center", marginTop: 20 }}>
                Source:{" "}
                <a href="https://sd41blogs.ca/smithc/weekly-assignments-submission-details/"
                  target="_blank" rel="noreferrer" style={{ color: "#B4B2A9" }}>
                  Ms. Smith's blog
                </a>
                {" "}· Refreshes every 15 min · Shared for all
              </p>
            )}
          </div>
        )}

        {/* LIVE TAB */}
        {tab === "live" && (
          <div style={{ animation: "fadeUp 0.25s ease" }}>
            <div style={{
              background: "#fff", border: "1px solid #E8E6DF",
              borderRadius: 10, overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderBottom: "1px solid #E8E6DF",
                background: "#FAFAF8",
              }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {["#F09595","#FAC775","#97C459"].map(c => (
                    <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: "#B4B2A9", flex: 1, textAlign: "center" }}>
                  sd41blogs.ca/smithc/weekly-assignments-submission-details
                </span>
                <a
                  href="https://sd41blogs.ca/smithc/weekly-assignments-submission-details/"
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: "#185FA5", textDecoration: "none" }}
                >
                  Open ↗
                </a>
              </div>
              {data?.safeHtml ? (
                <iframe
                  ref={iframeRef}
                  title="Ms. Smith's assignments page"
                  style={{ width: "100%", height: 600, border: "none", display: "block" }}
                  sandbox="allow-same-origin"
                />
              ) : (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#B4B2A9", fontSize: 13 }}>
                  {loading ? "Loading…" : "No content available"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHANGES TAB */}
        {tab === "changes" && (
          <div style={{ animation: "fadeUp 0.25s ease" }}>
            {!data || data.recentChanges.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#B4B2A9" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>—</div>
                <div style={{ fontSize: 14 }}>No changes detected yet.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Changes appear when Ms. Smith updates her page.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.recentChanges.map((event, i) => (
                  <div key={i} style={{
                    background: "#fff", border: "1px solid #E8E6DF",
                    borderRadius: 10, overflow: "hidden",
                    animation: `fadeUp 0.25s ease both`,
                    animationDelay: `${i * 40}ms`,
                  }}>
                    <div style={{
                      padding: "10px 14px", borderBottom: "1px solid #F1EFE8",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a18" }}>
                        {event.changes.length} change{event.changes.length !== 1 ? "s" : ""} detected
                      </span>
                      <span style={{ fontSize: 11, color: "#B4B2A9" }}>{timeAgo(event.detectedAt)}</span>
                    </div>
                    <div>
                      {event.changes.map((change, j) => (
                        <div key={j} style={{
                          display: "flex", alignItems: "flex-start", gap: 10,
                          padding: "9px 14px",
                          borderBottom: j < event.changes.length - 1 ? "1px solid #F7F6F2" : "none",
                          background: change.type === "removed" ? "#fffafa" : change.type === "added" ? "#f5fff7" : "#fafff5",
                        }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2,
                            color: change.type === "removed" ? "#A32D2D" : "#3B6D11",
                            letterSpacing: "0.04em",
                          }}>
                            {change.type === "removed" ? "−" : "+"}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <Pill color={getAccent(change.subject)}>{change.subject}</Pill>
                            <span style={{ fontSize: 13, color: "#2c2c2a", lineHeight: 1.5 }}>{change.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
