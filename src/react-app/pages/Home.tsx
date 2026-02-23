import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, BarChart3, Clock, CheckCircle, Circle, BookOpen, Calculator, FlaskConical, Globe, Palette, Heart, Briefcase, Music, Settings } from "lucide-react";

interface FetchResult {
  success: boolean;
  content?: string;
  fetchedAt?: string;
  error?: string;
}

interface SubjectChange {
  name: string;
  changes: string[];
}

interface Summary {
  hasChanges: boolean;
  summary: string;
  subjects: SubjectChange[];
  timestamp: Date;
}

const SUBJECT_FILTERS = [
  { id: "all", label: "All", icon: null },
  { id: "language-arts", label: "Language Arts", icon: BookOpen },
  { id: "math", label: "Math", icon: Calculator },
  { id: "science", label: "Science", icon: FlaskConical },
  { id: "social-studies", label: "Social Studies", icon: Globe },
  { id: "art-adst", label: "Art/ADST", icon: Palette },
  { id: "phe", label: "Physical and Health Education", icon: Heart },
  { id: "career", label: "Career", icon: Briefcase },
  { id: "music", label: "Music", icon: Music },
  { id: "other", label: "Other", icon: Settings },
];

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const previousContent = useRef<string | null>(null);
  const isFirstFetch = useRef(true);

  const summarizeChanges = useCallback(async (oldContent: string, newContent: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previousContent: oldContent, currentContent: newContent }),
      });
      const result = await res.json();
      
      if (result.success && result.hasChanges) {
        const now = new Date();
        setLastUpdated(now);
        setSummaries(prev => [{
          hasChanges: result.hasChanges,
          summary: result.summary,
          subjects: result.subjects,
          timestamp: now,
        }, ...prev].slice(0, 20));
      }
    } catch (error) {
      console.error("Failed to summarize:", error);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/assignments");
      const result: FetchResult = await res.json();
      setLastCheck(new Date());
      
      if (result.success && result.content) {
        if (previousContent.current && previousContent.current !== result.content) {
          await summarizeChanges(previousContent.current, result.content);
        } else if (isFirstFetch.current) {
          setSummaries([{
            hasChanges: false,
            summary: "Monitoring started. You'll see updates here when the page changes.",
            subjects: [],
            timestamp: new Date(),
          }]);
          isFirstFetch.current = false;
        }
        previousContent.current = result.content;
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [summarizeChanges]);

  useEffect(() => {
    fetchAssignments();
    const interval = setInterval(fetchAssignments, 5000);
    return () => clearInterval(interval);
  }, [fetchAssignments]);

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const filterSummaries = (items: Summary[]) => {
    if (activeFilter === "all") return items;
    return items.filter(s => 
      s.subjects.some(sub => 
        sub.name.toLowerCase().replace(/[\s\/]/g, "-").includes(activeFilter)
      )
    );
  };

  const filteredSummaries = filterSummaries(summaries);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] to-[#0f1322] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1a1f2e]/95 backdrop-blur-sm border-b border-[#2d3848]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white to-blue-400 bg-clip-text text-transparent">
              Homework Updates
            </h1>
            <p className="text-sm text-[#8892a4] mt-1">
              Monitor Ms. Smith's Blog for assignments
            </p>
          </div>
          <button
            onClick={() => fetchAssignments()}
            disabled={loading || analyzing}
            className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || analyzing) ? "animate-spin" : ""}`} />
            Check Now
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <StatCard
            icon={<BarChart3 className="w-7 h-7" />}
            label="Total Updates"
            value={summaries.filter(s => s.hasChanges).length.toString()}
          />
          <StatCard
            icon={<Clock className="w-7 h-7" />}
            label="Last Updated"
            value={lastUpdated ? formatRelativeTime(lastUpdated) : "--"}
          />
          <StatCard
            icon={<CheckCircle className="w-7 h-7" />}
            label="Last Checked"
            value={lastCheck ? formatRelativeTime(lastCheck) : "--"}
          />
          <StatCard
            icon={<Circle className="w-7 h-7 text-emerald-400 fill-emerald-400" />}
            label="Status"
            value="Live"
            valueClass="text-emerald-400"
          />
        </div>

        {/* Updates Section */}
        <section className="bg-[#1a1f2e] rounded-xl border border-[#2d3848] p-6 lg:p-8">
          <div className="flex items-center justify-between pb-5 mb-6 border-b border-[#2d3848]">
            <h2 className="text-lg font-bold">Recent Updates</h2>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          </div>

          {/* Subject Tabs */}
          <div className="flex gap-2 mb-6 pb-4 border-b border-[#2d3848] overflow-x-auto scrollbar-thin scrollbar-thumb-[#2d3848]">
            {SUBJECT_FILTERS.map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeFilter === filter.id
                    ? "text-blue-400 border-blue-400"
                    : "text-[#e0e6ed] border-transparent hover:text-white hover:border-[#2d3848]"
                }`}
              >
                {filter.icon && <filter.icon className="w-3.5 h-3.5" />}
                {filter.label}
                {activeFilter === filter.id && (
                  <span className="w-1 h-1 rounded-full bg-blue-400 ml-1" />
                )}
              </button>
            ))}
          </div>

          {/* Updates List */}
          <div className="space-y-4">
            {loading && summaries.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-10 h-10 border-3 border-[#2d3848] border-t-blue-400 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-[#8892a4]">Loading homework updates...</p>
              </div>
            ) : filteredSummaries.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-3xl mb-4">📚</p>
                <p className="text-[#8892a4]">
                  {activeFilter === "all" 
                    ? "No updates yet. The system is monitoring for changes." 
                    : "No homework updates for this subject."}
                </p>
              </div>
            ) : (
              filteredSummaries.map((summary, index) => (
                <UpdateCard
                  key={index}
                  summary={summary}
                  isLatest={index === 0}
                  formatTime={formatRelativeTime}
                />
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1f2e] border-t border-[#2d3848] mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-4 text-center text-xs text-[#8892a4]">
          Made in Canada 🍁
        </div>
      </footer>

      {/* Analyzing Toast */}
      {analyzing && (
        <div className="fixed top-24 right-6 bg-[#1a1f2e] border border-blue-400/30 text-white px-5 py-3 rounded-xl shadow-lg animate-in slide-in-from-right text-sm font-medium">
          <span className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            Analyzing changes...
          </span>
        </div>
      )}
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  valueClass = "" 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-[#2d3848] p-5 flex items-start gap-4 transition-all hover:border-blue-400 hover:bg-gradient-to-br hover:from-[#1a1f2e] hover:to-blue-500/5 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(59,130,246,0.2)] group">
      <div className="text-[#8892a4] group-hover:text-blue-400 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider font-bold text-[#8892a4] mb-1">
          {label}
        </p>
        <p className={`text-xl font-bold ${valueClass}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function UpdateCard({ 
  summary, 
  isLatest, 
  formatTime 
}: { 
  summary: Summary; 
  isLatest: boolean;
  formatTime: (date: Date) => string;
}) {
  return (
    <div className="bg-gradient-to-br from-[#242d3d] to-blue-500/[0.02] border border-[#2d3848] border-l-4 border-l-blue-400 rounded-xl p-5 transition-all hover:bg-gradient-to-br hover:from-blue-500/[0.08] hover:to-blue-500/[0.04] hover:border-blue-400 hover:translate-x-1.5 hover:shadow-[0_8px_24px_rgba(59,130,246,0.15)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">
          {isLatest ? "Latest" : "Update"}
        </h3>
        <span className="text-xs text-[#8892a4] bg-[#1a1f2e] px-2.5 py-1 rounded-md border border-[#2d3848]">
          {formatTime(summary.timestamp)}
        </span>
      </div>
      
      <p className="text-sm text-[#e0e6ed] leading-relaxed mb-4">
        {summary.summary}
      </p>

      {summary.subjects.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-[#2d3848]">
          {summary.subjects.map((subject, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <BookOpen className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-semibold text-white">
                  {subject.name}
                </span>
                <ul className="mt-1 space-y-0.5">
                  {subject.changes.map((change, cIdx) => (
                    <li key={cIdx} className="text-xs text-[#8892a4]">
                      • {change}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
