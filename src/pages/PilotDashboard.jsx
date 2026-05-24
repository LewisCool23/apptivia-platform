import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { BACKEND_BASE } from "../utils/backendFetch";

// ── Constants ────────────────────────────────────────────────────────────────

const WINDOW_OPTIONS = [
  { label: "30d", value: 30 },
  { label: "60d", value: 60 },
  { label: "90d", value: 90 },
];

// The three Cornell Learn-It-All riskiest assumptions being validated
const VALIDATION_META = [
  {
    key: "q1_adoption",
    assumption: "Riskiest Assumption #1",
    label: "Platform Adoption",
    description: "Managers & reps return to Apptivia unprompted — measured by distinct active users and Aaron AI engagement",
    metric: "active_users",
    metricLabel: "Active Users",
    threshold: 3,
    thresholdLabel: "≥3 to confirm",
  },
  {
    key: "q2_behavior_change",
    assumption: "Riskiest Assumption #2",
    label: "AI Behavior Change",
    description: "Team uses AI coaching tools — coaching plans created, IDPs drafted, Aaron AI conversations",
    metric: "ai_coaching_activities",
    metricLabel: "AI Coaching Activities",
    threshold: 5,
    thresholdLabel: "≥5 to confirm",
  },
  {
    key: "q3_willingness_to_pay",
    assumption: "Riskiest Assumption #3",
    label: "Plan Conversion",
    description: "$19 → $49 upgrade conversion within 90 days",
    metric: null, // derived from subscription.converted_to_paid
    metricLabel: "Trial → Paid Conversion",
    threshold: null,
  },
];

// ── Utility ──────────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function daysRemaining(isoEnd) {
  if (!isoEnd) return null;
  const diff = new Date(isoEnd) - new Date();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function getSignalStatus(value, threshold) {
  if (threshold === null) return null;
  if (value === 0) return "cold";
  if (value < threshold) return "warming";
  return "confirmed";
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusPip({ status }) {
  const map = {
    confirmed: { color: "#FF4D2E", label: "CONFIRMED", pulse: true },
    warming:   { color: "#F59E0B", label: "IN PROGRESS", pulse: false },
    cold:      { color: "#52525B", label: "NO DATA", pulse: false },
    pending:   { color: "#F59E0B", label: "TRIAL ACTIVE", pulse: true },
    converted: { color: "#FF4D2E", label: "CONVERTED", pulse: true },
    expired:   { color: "#C8341B", label: "EXPIRED", pulse: false },
  };
  const cfg = map[status] || map.cold;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        display: "inline-block",
        width: 8, height: 8, borderRadius: "50%",
        background: cfg.color,
        boxShadow: cfg.pulse ? `0 0 0 0 ${cfg.color}44` : "none",
        animation: cfg.pulse ? "pip-pulse 2s infinite" : "none",
      }} />
      <span style={{
        fontFamily: "'Geist Mono', monospace",
        fontSize: 10,
        letterSpacing: "0.12em",
        color: cfg.color,
        fontWeight: 700,
      }}>
        {cfg.label}
      </span>
    </span>
  );
}

function MetricCounter({ value, label, sublabel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{
        fontFamily: "'Geist Mono', monospace",
        fontSize: 36,
        fontWeight: 700,
        color: "#F7F5F2",
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}>
        {value ?? "—"}
      </span>
      <span style={{
        fontFamily: "'Geist Mono', monospace",
        fontSize: 10,
        color: "rgba(247,245,242,0.55)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}>
        {label}
      </span>
      {sublabel && (
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 9,
          color: "rgba(247,245,242,0.4)",
          letterSpacing: "0.08em",
        }}>
          {sublabel}
        </span>
      )}
    </div>
  );
}

function AssumptionCard({ meta, signals, subscription }) {
  const isWTP = meta.key === "q3_willingness_to_pay";

  let value, statusKey;

  if (isWTP) {
    if (subscription?.converted_to_paid) {
      statusKey = "converted";
      value = "PAID";
    } else if (subscription?.trial_active) {
      statusKey = "pending";
      const days = daysRemaining(subscription.trial_ends_at);
      value = days !== null ? `${days}d left` : "TRIAL";
    } else if (subscription?.trial_expired) {
      statusKey = "expired";
      value = "EXPIRED";
    } else {
      statusKey = "cold";
      value = "—";
    }
  } else {
    value = signals?.[meta.metric] ?? 0;
    statusKey = getSignalStatus(value, meta.threshold);
  }

  const borderColor = {
    confirmed: "#FF4D2E",
    converted: "#FF4D2E",
    warming:   "#F59E0B",
    pending:   "#F59E0B",
    cold:      "#27272A",
    expired:   "#C8341B",
  }[statusKey] || "#27272A";

  return (
    <div style={{
      background: "#18181B",
      border: `1px solid ${borderColor}22`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 6,
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      transition: "border-color 0.3s",
      position: "relative",
      overflow: "hidden",
      minHeight: 220,
      height: "100%",
    }}>
      {/* Background glow on confirmed */}
      {(statusKey === "confirmed" || statusKey === "converted") && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          width: 120, height: 120,
          background: "radial-gradient(circle at top right, rgba(255, 77, 46, 0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 9,
            color: "rgba(247,245,242,0.5)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}>
            {meta.assumption}
          </div>
          <div style={{
            fontFamily: "'Geist', sans-serif",
            fontSize: 15,
            fontWeight: 600,
            color: "rgba(247,245,242,0.85)",
            letterSpacing: "-0.01em",
          }}>
            {meta.label}
          </div>
        </div>
        <StatusPip status={statusKey} />
      </div>

      {/* Description */}
      <div style={{
        fontFamily: "'Geist', sans-serif",
        fontSize: 12,
        color: "rgba(247,245,242,0.5)",
        lineHeight: 1.5,
        borderTop: "1px solid #27272A",
        paddingTop: 12,
        flex: 1,
      }}>
        {meta.description}
      </div>

      {/* Metric */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <MetricCounter
          value={value}
          label={meta.metricLabel}
          sublabel={!isWTP ? meta.thresholdLabel : null}
        />
        {/* Progress bar for numeric metrics */}
        {!isWTP && meta.threshold && (
          <div style={{ flex: 1, marginLeft: 20 }}>
            <div style={{
              height: 3,
              background: "#27272A",
              borderRadius: 2,
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, (value / meta.threshold) * 100)}%`,
                background: borderColor,
                borderRadius: 2,
                transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>
            <div style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 9,
              color: "rgba(247,245,242,0.5)",
              marginTop: 4,
              textAlign: "right",
            }}>
              {Math.min(100, Math.round((value / meta.threshold) * 100))}% to threshold
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value, max, color = "#FF4D2E" }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: 12,
          color: "rgba(247,245,242,0.55)",
        }}>{label}</span>
        <span style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          color: "rgba(247,245,242,0.85)",
          fontWeight: 600,
        }}>{value}</span>
      </div>
      <div style={{ height: 2, background: "#27272A", borderRadius: 1 }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color, borderRadius: 1,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function PilotDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [window, setWindow] = useState(90);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated. Please log in and try again.");
      }
      const res = await fetch(`${BACKEND_BASE}/api/pilot/adoption-signals?days=${window}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Server returned an unexpected response. Ensure you are logged in as an admin.");
      }
      if (res.status === 401) {
        throw new Error("Session expired. Please log out and log back in.");
      }
      if (res.status === 403) {
        throw new Error("Admin access required. This dashboard is restricted to admin users.");
      }
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const signals = data?.signals;
  const subscription = data?.subscription;

  // Compute overall pilot health score (0–100)
  const healthScore = (() => {
    if (!data) return 0;
    let score = 0;
    // Card 1: Platform Adoption (active users)
    if ((signals?.active_users || 0) >= 3) score += 34;
    else if ((signals?.active_users || 0) > 0) score += 17;
    // Card 2: AI Behavior Change (coaching activities)
    if ((signals?.ai_coaching_activities || 0) >= 5) score += 33;
    else if ((signals?.ai_coaching_activities || 0) > 0) score += 16;
    // Card 3: Plan Conversion
    if (subscription?.converted_to_paid) score += 33;
    else if (subscription?.trial_active) score += 10;
    return score;
  })();

  const healthColor = healthScore >= 66 ? "#FF4D2E" : healthScore >= 33 ? "#F59E0B" : "#C8341B";

  return (
    <>
      {/* Inject Google Fonts + keyframes */}
      <style>{`
        @keyframes pip-pulse {
          0%   { box-shadow: 0 0 0 0 currentColor44; }
          70%  { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pilot-card { animation: fade-in 0.4s ease both; }
        .pilot-card:nth-child(2) { animation-delay: 0.05s; }
        .pilot-card:nth-child(3) { animation-delay: 0.10s; }
        .window-btn { cursor: pointer; transition: all 0.15s; }
        .window-btn:hover { background: #27272A !important; }
        .refresh-btn { cursor: pointer; transition: all 0.15s; }
        .refresh-btn:hover { background: #27272A !important; color: #FF4D2E !important; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#0A0A0B",
        color: "#F7F5F2",
        fontFamily: "'Geist', sans-serif",
        padding: "32px 24px",
        maxWidth: 900,
        margin: "0 auto",
      }}>

        {/* —— Header ————————————————————————————————————————— */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", flexWrap: "wrap", gap: 16,
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 20, letterSpacing: "-0.03em" }}>
                  <span style={{ fontWeight: 900, color: "#F7F5F2" }}>app</span>
                  <span style={{ fontWeight: 500, color: "#FF4D2E" }}>tivia</span>
                </span>
                <span style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9,
                  color: "rgba(247,245,242,0.4)",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  borderLeft: "1px solid rgba(247,245,242,0.15)",
                  paddingLeft: 12,
                }}>
                  Sales Performance Intelligence
                </span>
              </div>
              <h1 style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                color: "#F7F5F2",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}>
                Planera Pilot Dashboard
              </h1>
              <p style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: "rgba(247,245,242,0.5)",
                lineHeight: 1.4,
              }}>
                Demand validation · May – July 2026
              </p>
              <button
                onClick={() => navigate('/scorecard')}
                style={{
                  marginTop: 10,
                  padding: "5px 12px",
                  borderRadius: 4,
                  border: "1px solid #27272A",
                  background: "transparent",
                  color: "rgba(247,245,242,0.5)",
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "#FF4D2E"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(247,245,242,0.5)"}
              >
                ← Back to Scorecard
              </button>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {/* Window selector */}
              <div style={{
                display: "flex", gap: 2,
                background: "#18181B",
                border: "1px solid #27272A",
                borderRadius: 5, padding: 2,
              }}>
                {WINDOW_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className="window-btn"
                    onClick={() => setWindow(opt.value)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 3,
                      border: "none",
                      background: window === opt.value ? "#27272A" : "transparent",
                      color: window === opt.value ? "#FF4D2E" : "rgba(247,245,242,0.5)",
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Refresh */}
              <button
                className="refresh-btn"
                onClick={fetchData}
                disabled={loading}
                style={{
                  padding: "7px 14px",
                  borderRadius: 5,
                  border: "1px solid #27272A",
                  background: "#18181B",
                  color: "rgba(247,245,242,0.5)",
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  letterSpacing: "0.05em",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span style={{
                  display: "inline-block",
                  animation: loading ? "spin 1s linear infinite" : "none",
                  fontSize: 13,
                }}>♻</span>
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          {/* Last refresh + since */}
          {lastRefresh && (
            <div style={{
              marginTop: 12,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 9,
              color: "rgba(247,245,242,0.3)",
              letterSpacing: "0.1em",
            }}>
              LAST UPDATED {lastRefresh.toLocaleTimeString()}
              {data?.since && ` · WINDOW SINCE ${formatDate(data.since)}`}
            </div>
          )}
        </div>

        {/* —— Error state ———————————————————————————————————— */}
        {error && (
          <div style={{
            background: "rgba(200,52,27,0.1)",
            border: "1px solid rgba(200,52,27,0.2)",
            borderLeft: "3px solid #C8341B",
            borderRadius: 6,
            padding: "14px 18px",
            marginBottom: 24,
            fontFamily: "'Geist Mono', monospace",
            fontSize: 12,
            color: "#C8341B",
          }}>
            ⚠ {error}
          </div>
        )}

        {/* —— Pilot health score ————————————————————————————— */}
        <div style={{
          background: "#18181B",
          border: "1px solid #27272A",
          borderRadius: 6,
          padding: "20px 24px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}>
          {/* Score ring (CSS-only) */}
          <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
            <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="36" cy="36" r="30" fill="none" stroke="#27272A" strokeWidth="4" />
              <circle
                cx="36" cy="36" r="30"
                fill="none"
                stroke={healthColor}
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - healthScore / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <span style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 16, fontWeight: 700,
                color: healthColor, lineHeight: 1,
              }}>{healthScore}</span>
              <span style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 8, color: "rgba(247,245,242,0.5)", letterSpacing: "0.1em",
              }}>/ 100</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 15, fontWeight: 600, color: "rgba(247,245,242,0.85)",
              marginBottom: 4,
            }}>
              Pilot Health Score
            </div>
            <div style={{
              fontFamily: "'Geist', sans-serif",
              fontSize: 12, color: "rgba(247,245,242,0.5)", lineHeight: 1.5,
            }}>
              {healthScore >= 66
                ? "Strong validation signal. All three riskiest assumptions are showing positive indicators."
                : healthScore >= 33
                ? "Partial validation. At least one assumption is confirming — continue monitoring."
                : "Early stage. Pilot is live but demand signals have not yet accumulated."
              }
            </div>
          </div>

          {/* Subscription badge */}
          {subscription && (
            <div style={{
              background: "#0A0A0B",
              border: "1px solid #27272A",
              borderRadius: 5,
              padding: "10px 16px",
              textAlign: "center",
              minWidth: 120,
            }}>
              <div style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 9, color: "rgba(247,245,242,0.5)",
                letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4,
              }}>Plan</div>
              <div style={{
                fontFamily: "'Geist', sans-serif",
                fontSize: 16, fontWeight: 700,
                color: subscription.converted_to_paid ? "#FF4D2E" : "rgba(247,245,242,0.85)",
              }}>
                {subscription.plan}
              </div>
              <div style={{ marginTop: 4 }}>
                <StatusPip status={
                  subscription.converted_to_paid ? "converted" :
                  subscription.trial_active ? "pending" :
                  subscription.trial_expired ? "expired" : "cold"
                } />
              </div>
              {subscription.trial_ends_at && subscription.trial_active && (
                <div style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9, color: "rgba(247,245,242,0.5)", marginTop: 6,
                }}>
                  {daysRemaining(subscription.trial_ends_at)}d remaining
                </div>
              )}
            </div>
          )}
        </div>

        {/* —— Three assumption cards ————————————————————————— */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
          marginBottom: 24,
          alignItems: "stretch",
        }}>
          {VALIDATION_META.map((meta) => (
            <div key={meta.key} className="pilot-card">
              <AssumptionCard
                meta={meta}
                signals={signals}
                subscription={subscription}
              />
            </div>
          ))}
        </div>

        {/* —— Signal breakdown ——————————————————————————————— */}
        <div style={{
          background: "#18181B",
          border: "1px solid #27272A",
          borderRadius: 6,
          padding: "20px 24px",
          marginBottom: 16,
        }}>
          <div style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 9, color: "rgba(247,245,242,0.5)",
            letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 16,
          }}>
            Signal Breakdown · Last {window} Days
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <StatBar
              label="Active Users"
              value={signals?.active_users ?? 0}
              max={Math.max(10, signals?.active_users ?? 0)}
              color="#FF4D2E"
            />
            <StatBar
              label="Aaron AI Conversations"
              value={signals?.aaron_conversations ?? 0}
              max={Math.max(10, signals?.aaron_conversations ?? 0)}
              color="#FF4D2E"
            />
            <StatBar
              label="Aaron AI Messages"
              value={signals?.aaron_messages ?? 0}
              max={Math.max(50, signals?.aaron_messages ?? 0)}
              color="#F7F5F2"
            />
            <StatBar
              label="Coaching Plans Created"
              value={signals?.coaching_plans_created ?? 0}
              max={Math.max(10, signals?.coaching_plans_created ?? 0)}
              color="#F7F5F2"
            />
            <StatBar
              label="IDPs Drafted"
              value={signals?.idp_drafts_created ?? 0}
              max={Math.max(10, signals?.idp_drafts_created ?? 0)}
              color="#71717A"
            />
            <StatBar
              label="Coaching Suggestions Sent"
              value={signals?.coaching_suggestions_sent ?? 0}
              max={Math.max(10, signals?.coaching_suggestions_sent ?? 0)}
              color="#71717A"
            />
            <StatBar
              label="Outreach Drafts Created"
              value={signals?.outreach_drafts_created ?? 0}
              max={Math.max(10, signals?.outreach_drafts_created ?? 0)}
              color="#71717A"
            />
          </div>
        </div>

        {/* —— Footer ——————————————————————————————————————— */}
        <div style={{
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 9, color: "rgba(247,245,242,0.3)", letterSpacing: "0.1em",
          borderTop: "1px solid #18181B", paddingTop: 16,
        }}>
          <span>APPTIVIA · ADMIN ONLY · GET /api/pilot/adoption-signals</span>
          <span>LEARN-IT-ALL FRAMEWORK · CORNELL / GIROTRA · MAY–JULY 2026</span>
        </div>
      </div>
    </>
  );
}
