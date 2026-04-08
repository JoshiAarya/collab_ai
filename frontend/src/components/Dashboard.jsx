import React, { useState, useEffect } from 'react';
import apiRequest from '../utils/api.js';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import ProjectIntelligenceCard from './ProjectIntelligenceCard';
import DecisionTimeline from './DecisionTimeline';
import BlockerTracker from './BlockerTracker';
import PendingSignals from './PendingSignals';

// ─── Color Helpers ────────────────────────────────────────────────────────────

const STAGE_COLORS = {
  ideation: '#8b5cf6', design: '#3b82f6', discussion: '#10b981',
  blocked: '#ef4444', completed: '#06b6d4'
};

const SEVERITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };

const TREND = {
  rising:  { icon: '↑', color: '#10b981' },
  stable:  { icon: '→', color: '#f59e0b' },
  falling: { icon: '↓', color: '#ef4444' }
};

const formatDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ─── Noise Filter ─────────────────────────────────────────────────────────────

function getValidBlockers(blockers) {
  if (!blockers || !Array.isArray(blockers)) return [];
  return blockers.filter(b => {
    const text = b.text || b;
    if (!text || typeof text !== 'string') return false;
    const n = text.toLowerCase().trim();
    return !(n === 'none' || n === 'none mentioned' || n === 'no blockers' ||
             n === 'n/a' || n.startsWith('no ') || n.length < 5);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard({ project, onClose, token, colors }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedModal, setExpandedModal] = useState(null);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/projects/${project._id}/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setDashboard(data.dashboard);
    } catch (e) { console.error('Dashboard load error:', e); }
    finally { setLoading(false); }
  };

  const refreshDashboard = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/projects/${project._id}/dashboard/refresh`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setDashboard(data.dashboard);
    } catch (e) { console.error('Dashboard refresh error:', e); }
    finally { setLoading(false); }
  };

  const stageColor = STAGE_COLORS[dashboard?.stage] || '#6b7280';
  const momentum = dashboard ? Math.round(dashboard.totalMessages / Math.max(dashboard.activeDiscussions, 1)) : 0;
  const validBlockers = dashboard ? getValidBlockers(dashboard.openQuestions) : [];

  const topicData = (dashboard?.topics || []).map(t => typeof t === 'string' ? { name: t, count: 1 } : t);
  const sortedTopics = [...topicData].sort((a, b) => (b.count || 0) - (a.count || 0));
  const topTopics = sortedTopics.slice(0, 6);
  const maxCount = Math.max(...topTopics.map(t => t.count || 1), 1);

  const ps = dashboard?.projectState;
  const trend = ps?.momentum?.trend || 'stable';
  const trendInfo = TREND[trend];

  // Accent color for topic bars
  const TOPIC_COLORS = ['#667eea', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={{ ...S.header, background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
        <div style={S.headerLeft}>
          <button onClick={onClose} style={{ ...S.backBtn, border: `1px solid ${colors.border}`, color: colors.text }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ ...S.title, color: colors.text }}>Dashboard</h1>
              <span style={{ ...S.stagePill, background: `${stageColor}18`, color: stageColor, border: `1px solid ${stageColor}30` }}>
                {(dashboard?.stage || 'ideation').charAt(0).toUpperCase() + (dashboard?.stage || 'ideation').slice(1)}
              </span>
            </div>
            <p style={{ ...S.subtitle, color: colors.textSecondary }}>{project.title}</p>
          </div>
        </div>
        <button onClick={refreshDashboard} style={{ ...S.refreshBtn, background: `${colors.border}60`, color: colors.text }} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={loading ? { animation: 'spin 1s linear infinite' } : {}}>
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Gradient accent line */}
      <div style={S.accentLine} />

      {loading && !dashboard ? (
        <div style={S.loadingWrap}>
          <div style={S.spinner} />
          <p style={{ color: colors.textSecondary, fontSize: '14px' }}>Loading intelligence...</p>
        </div>
      ) : dashboard ? (
        <div style={S.content}>

          <PendingSignals projectId={project._id} onRefreshDashboard={refreshDashboard} />

          {/* ── Metric Cards ── */}
          <div style={S.metricsRow}>
            <MetricCard
              label="Momentum"
              value={<>{trendInfo.icon} {ps?.momentum?.recentMessageCount ?? momentum}</>}
              sub="msgs/week"
              accent={trendInfo.color}
              colors={colors}
            />
            <MetricCard
              label="Blockers"
              value={validBlockers.length}
              sub="open issues"
              accent={validBlockers.length > 0 ? '#ef4444' : '#10b981'}
              colors={colors}
              glow={validBlockers.length > 0}
            />
            <MetricCard
              label="Actions"
              value={dashboard.actionItems?.length || 0}
              sub="pending"
              accent="#667eea"
              colors={colors}
            />
            <MetricCard
              label="Topics"
              value={ps?.activeTopicCount || topTopics.length}
              sub="stabilized"
              accent="#8b5cf6"
              colors={colors}
            />
          </div>

          {/* ── Strategic Signals ── */}
          {dashboard.signals?.length > 0 && (
            <div style={S.signalsWrap}>
              {dashboard.signals.map((sig, i) => {
                const c = sig.severity === 'high' ? '#ef4444' : sig.severity === 'medium' ? '#f59e0b' : '#6b7280';
                const icon = sig.type === 'decision_drift' ? '⚡' : sig.type === 'blocker_stagnation' ? '🔴' : '📉';
                return (
                  <div key={i} style={{ ...S.signalBanner, background: `${c}0a`, border: `1px solid ${c}25` }}>
                    <span style={{ fontSize: '15px' }}>{icon}</span>
                    <span style={{ fontSize: '13px', color: colors.text, lineHeight: '1.5' }}>{sig.message}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Main Grid ── */}
          <div style={S.grid}>

            {/* Current Project Summary (Derived Understanding Layer) */}
            {ps?.pinnedContext && (
              <Card title="Current Project Summary" icon="💡" colors={colors} style={{ gridColumn: '1 / -1' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: colors.text, fontFamily: 'inherit', margin: 0, lineHeight: 1.5 }}>
                  {ps.pinnedContext}
                </pre>
              </Card>
            )}

            {/* Left Column */}
            <div style={S.leftCol}>

              {/* Decision Timeline */}
              {dashboard.enrichedDecisions?.length > 0 && (
                <Card title="Decision Timeline" icon="📋" colors={colors}>
                  <DecisionTimeline enrichedDecisions={dashboard.enrichedDecisions} colors={colors} />
                </Card>
              )}

              {/* Revised Decisions */}
              {dashboard.enrichedSuperseded?.length > 0 && (
                <Card title="Revised Decisions" icon="↩" colors={colors} accent="#6b7280" subtle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {dashboard.enrichedSuperseded.map((d, i) => (
                      <div key={i} style={{ ...S.revisionItem, background: colors.background, border: `1px solid ${colors.border}` }}>
                        <div style={{ fontSize: '13px', color: colors.textSecondary, textDecoration: 'line-through', marginBottom: d.supersededByText ? '8px' : 0 }}>
                          {d.text}
                        </div>
                        {d.supersededByText && (
                          <div style={{ fontSize: '13px', color: colors.text, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <span style={{ color: '#10b981', fontWeight: '600', flexShrink: 0 }}>→</span>
                            {d.supersededByText}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Topic Distribution */}
              <Card title="Topic Distribution" icon="🎯" colors={colors}
                action={sortedTopics.length > 6 ? { label: `+${sortedTopics.length - 6} more`, onClick: () => setExpandedModal('topics') } : null}>
                {topTopics.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {topTopics.map((t, i) => (
                      <div key={i} style={S.topicRow}>
                        <div style={{ ...S.topicName, color: colors.text }}>{t.name || t}</div>
                        <div style={{ flex: 1, height: '6px', background: `${colors.border}60`, borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '3px',
                            width: `${((t.count || 1) / maxCount) * 100}%`,
                            background: `linear-gradient(90deg, ${TOPIC_COLORS[i % TOPIC_COLORS.length]}, ${TOPIC_COLORS[i % TOPIC_COLORS.length]}90)`,
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                        <div style={{ ...S.topicCount, color: colors.textSecondary }}>{t.count || 1}</div>
                      </div>
                    ))}
                  </div>
                ) : <Empty colors={colors}>No topics identified yet</Empty>}
              </Card>

              {/* Blockers (flat list) */}
              <Card title="Blockers" icon="🚧" colors={colors}
                action={validBlockers.length > 5 ? { label: `View All (${validBlockers.length})`, onClick: () => setExpandedModal('blockers') } : null}>
                {validBlockers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {validBlockers.slice(0, 5).map((b, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', background: colors.background, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0, background: SEVERITY_COLORS[b.severity || 'medium'] }} />
                        <span style={{ fontSize: '13px', color: colors.text, lineHeight: '1.5' }}>{b.text || b}</span>
                      </div>
                    ))}
                  </div>
                ) : <Empty colors={colors}>No blockers — smooth sailing</Empty>}
              </Card>

              {/* Action Items */}
              <Card title="Action Items" icon="✅" colors={colors}
                action={dashboard.actionItems?.length > 5 ? { label: `View All (${dashboard.actionItems.length})`, onClick: () => setExpandedModal('actions') } : null}>
                {dashboard.actionItems?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {dashboard.actionItems.slice(0, 5).map((a, i) => (
                      <div key={i} style={{ ...S.actionRow, background: colors.background, border: `1px solid ${colors.border}` }}>
                        <div style={{ ...S.checkbox, borderColor: a.status === 'completed' ? '#10b981' : colors.border }}>
                          {a.status === 'completed' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <span style={{ fontSize: '13px', color: a.status === 'completed' ? colors.textSecondary : colors.text, textDecoration: a.status === 'completed' ? 'line-through' : 'none', lineHeight: '1.4' }}>
                          {a.text || a}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : <Empty colors={colors}>No action items</Empty>}
              </Card>
            </div>

            {/* Right Column */}
            <div style={S.rightCol}>

              {/* Project Intelligence (entity model) */}
              {ps && <ProjectIntelligenceCard projectState={ps} colors={colors} />}

              {/* Blocker Tracker (entity model) */}
              {dashboard.enrichedBlockers?.length > 0 && (
                <Card title="Blocker Tracker" icon="🔥" colors={colors}>
                  <BlockerTracker enrichedBlockers={dashboard.enrichedBlockers} colors={colors} />
                </Card>
              )}

              {/* Key Decisions (compact) */}
              <Card title="Key Decisions" icon="💡" colors={colors}
                action={dashboard.decisions?.length > 5 ? { label: `View All (${dashboard.decisions.length})`, onClick: () => setExpandedModal('decisions') } : null}>
                {dashboard.decisions?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {dashboard.decisions.slice(0, 5).map((d, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#667eea', marginTop: '7px', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: colors.text, lineHeight: '1.5' }}>{d.text || d}</span>
                      </div>
                    ))}
                  </div>
                ) : <Empty colors={colors}>No decisions yet</Empty>}
              </Card>

              {/* Current Stage */}
              <Card title="Current Stage" icon="🎯" colors={colors}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ ...S.stageBadge, background: stageColor }}>
                    {(dashboard.stage || 'ideation').charAt(0).toUpperCase() + (dashboard.stage || 'ideation').slice(1)}
                  </div>
                  {ps?.stageReason && (
                    <p style={{ fontSize: '12px', color: colors.textSecondary, margin: 0, fontStyle: 'italic' }}>{ps.stageReason}</p>
                  )}
                  {dashboard.lastUpdated && (
                    <p style={{ fontSize: '11px', color: colors.textSecondary, margin: 0 }}>Last updated {formatDate(dashboard.lastUpdated)}</p>
                  )}
                </div>
              </Card>

              {/* Activity */}
              <Card title="Activity" icon="📊" colors={colors}>
                <div style={S.activityChart}>
                  {(dashboard.activity || [0,0,0,0,0,0,0]).map((val, i) => {
                    const maxA = Math.max(...(dashboard.activity || [1]), 1);
                    return (
                      <div key={i} style={S.barCol}>
                        <div style={S.barTrack}>
                          <div style={{
                            ...S.barFill,
                            height: `${(val / maxA) * 100}%`,
                            background: i === 6 ? 'linear-gradient(180deg, #667eea, #764ba2)' : `${colors.border}`
                          }} />
                        </div>
                        <span style={{ fontSize: '10px', color: colors.textSecondary, fontWeight: '600' }}>
                          {['M','T','W','T','F','S','S'][i]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Contributors */}
              <Card title="Contributors" icon="👥" colors={colors}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dashboard.participants?.map((p, i) => {
                    const pct = Math.round((p.count / dashboard.totalMessages) * 100);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ ...S.avatar, background: getAvatarColor(p.username) }}>{getInitials(p.username)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: colors.text }}>{p.username}</div>
                          <div style={{ fontSize: '11px', color: colors.textSecondary }}>{p.count} messages ({pct}%)</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Summary */}
              <Card title="Summary" icon="📄" colors={colors}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  <SummaryRow label="Total Messages" value={dashboard.totalMessages} colors={colors} />
                  <SummaryRow label="Discussions" value={dashboard.activeDiscussions} colors={colors} />
                  <SummaryRow label="Documents" value={dashboard.documentCount} colors={colors} />
                  <SummaryRow label="Data Source"
                    value={<span style={{ color: dashboard.source === 'persistent' ? '#10b981' : '#f59e0b' }}>{dashboard.source === 'persistent' ? 'Cached' : 'Live'}</span>}
                    colors={colors} last />
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <div style={S.errorWrap}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style={{ color: colors.textSecondary }}>Failed to load dashboard</p>
          <button onClick={loadDashboard} style={S.retryBtn}>Retry</button>
        </div>
      )}

      {/* ── Modal ── */}
      {expandedModal && dashboard && (
        <div style={S.overlay} onClick={() => setExpandedModal(null)}>
          <div style={{ ...S.modal, background: colors.surface, border: `1px solid ${colors.border}` }} onClick={e => e.stopPropagation()}>
            <div style={{ ...S.modalHeader, borderBottom: `1px solid ${colors.border}` }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: 0 }}>
                {expandedModal === 'topics' && 'All Topics'}
                {expandedModal === 'decisions' && 'All Decisions'}
                {expandedModal === 'blockers' && 'All Blockers'}
                {expandedModal === 'actions' && 'All Action Items'}
              </h3>
              <button onClick={() => setExpandedModal(null)} style={{ ...S.modalClose, color: colors.textSecondary }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={S.modalBody}>
              {expandedModal === 'topics' && sortedTopics.map((t, i) => (
                <div key={i} style={{ ...S.topicRow, marginBottom: '12px' }}>
                  <div style={{ ...S.topicName, color: colors.text }}>{t.name || t}</div>
                  <div style={{ flex: 1, height: '6px', background: `${colors.border}60`, borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '3px', width: `${((t.count || 1) / maxCount) * 100}%`, background: TOPIC_COLORS[i % TOPIC_COLORS.length], transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ ...S.topicCount, color: colors.textSecondary }}>{t.count || 1}</div>
                </div>
              ))}
              {expandedModal === 'decisions' && dashboard.decisions.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#667eea', marginTop: '7px', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: colors.text, lineHeight: '1.5' }}>{d.text || d}</span>
                </div>
              ))}
              {expandedModal === 'blockers' && validBlockers.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', background: colors.background, borderRadius: '8px', border: `1px solid ${colors.border}`, marginBottom: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', background: SEVERITY_COLORS[b.severity || 'medium'] }} />
                  <span style={{ fontSize: '14px', color: colors.text, lineHeight: '1.5' }}>{b.text || b}</span>
                </div>
              ))}
              {expandedModal === 'actions' && dashboard.actionItems.map((a, i) => (
                <div key={i} style={{ ...S.actionRow, background: colors.background, border: `1px solid ${colors.border}`, marginBottom: '8px' }}>
                  <div style={{ ...S.checkbox, borderColor: a.status === 'completed' ? '#10b981' : colors.border }}>
                    {a.status === 'completed' && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span style={{ fontSize: '14px', color: colors.text, lineHeight: '1.4' }}>{a.text || a}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, icon, children, colors, action, accent, subtle, style }) {
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      borderLeft: accent ? `3px solid ${accent}` : undefined,
      opacity: subtle ? 0.85 : 1,
      animation: 'fadeIn 0.3s ease',
      ...(style || {})
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: colors.text, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{icon}</span> {title}
        </h3>
        {action && (
          <button onClick={action.onClick} style={{
            padding: '4px 10px', background: 'transparent', border: `1px solid ${colors.border}`,
            borderRadius: '6px', color: colors.textSecondary, fontSize: '11px', fontWeight: '500',
            cursor: 'pointer', transition: 'all 0.2s'
          }}>{action.label}</button>
        )}
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, sub, accent, colors, glow }) {
  return (
    <div style={{
      ...S.metricCard,
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      boxShadow: glow ? `0 0 20px ${accent}15, inset 0 1px 0 ${accent}10` : `0 2px 8px rgba(0,0,0,0.15)`,
    }}>
      <div style={{ fontSize: '11px', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '600', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '26px', fontWeight: '700', color: accent, lineHeight: 1, marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: colors.textSecondary }}>{sub}</div>
    </div>
  );
}

function SummaryRow({ label, value, colors, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${colors.border}30` }}>
      <span style={{ fontSize: '13px', color: colors.textSecondary }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: '600', color: typeof value === 'object' ? undefined : colors.text }}>{value}</span>
    </div>
  );
}

function Empty({ children, colors }) {
  return <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: colors.textSecondary, fontStyle: 'italic' }}>{children}</div>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 32px'
  },
  headerLeft: {
    display: 'flex', alignItems: 'center', gap: '16px'
  },
  backBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '36px', height: '36px', padding: 0,
    background: 'transparent', borderRadius: '8px',
    cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit'
  },
  title: {
    fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em'
  },
  subtitle: {
    fontSize: '13px', margin: '2px 0 0 0'
  },
  stagePill: {
    fontSize: '11px', fontWeight: '600', padding: '4px 12px',
    borderRadius: '20px', letterSpacing: '0.3px'
  },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', border: 'none', borderRadius: '8px',
    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'all 0.2s'
  },
  accentLine: {
    height: '2px',
    background: 'linear-gradient(90deg, #667eea 0%, #8b5cf6 30%, #10b981 60%, #f59e0b 100%)',
    opacity: 0.5
  },
  content: {
    padding: '24px 32px 48px', maxWidth: '1400px', margin: '0 auto'
  },
  metricsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px', marginBottom: '24px'
  },
  metricCard: {
    borderRadius: '12px', padding: '20px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    animation: 'fadeIn 0.3s ease'
  },
  signalsWrap: {
    display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px'
  },
  signalBanner: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    padding: '12px 16px', borderRadius: '10px'
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1.2fr 1fr',
    gap: '16px', alignItems: 'start'
  },
  leftCol: { display: 'flex', flexDirection: 'column' },
  rightCol: { display: 'flex', flexDirection: 'column' },
  topicRow: {
    display: 'grid', gridTemplateColumns: '130px 1fr 30px',
    alignItems: 'center', gap: '12px'
  },
  topicName: {
    fontSize: '13px', fontWeight: '500',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  },
  topicCount: {
    fontSize: '13px', fontWeight: '600', textAlign: 'right'
  },
  revisionItem: {
    padding: '12px 14px', borderRadius: '8px'
  },
  actionRow: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', borderRadius: '8px'
  },
  checkbox: {
    width: '16px', height: '16px', borderRadius: '4px',
    border: '2px solid #4b5563', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0
  },
  stageBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 18px', borderRadius: '8px', fontSize: '14px',
    fontWeight: '600', color: '#fff', textTransform: 'capitalize',
    alignSelf: 'flex-start'
  },
  activityChart: {
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    height: '80px', gap: '6px', padding: '8px 0'
  },
  barCol: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '6px', height: '100%'
  },
  barTrack: {
    width: '100%', flex: 1, borderRadius: '4px',
    position: 'relative', overflow: 'hidden'
  },
  barFill: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderRadius: '4px', transition: 'height 0.4s ease'
  },
  avatar: {
    width: '30px', height: '30px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: '600', color: '#fff', flexShrink: 0
  },
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '400px', gap: '16px'
  },
  spinner: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#667eea',
    animation: 'spin 0.8s linear infinite'
  },
  errorWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '400px', gap: '16px', color: '#8e8ea0'
  },
  retryBtn: {
    padding: '10px 24px', background: '#667eea', border: 'none',
    borderRadius: '8px', color: '#fff', fontSize: '14px',
    fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit'
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 1000
  },
  modal: {
    width: '90%', maxWidth: '600px', maxHeight: '80vh',
    borderRadius: '14px', overflow: 'hidden'
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px'
  },
  modalClose: {
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
    display: 'flex', transition: 'opacity 0.2s'
  },
  modalBody: {
    padding: '20px', overflowY: 'auto', maxHeight: 'calc(80vh - 60px)'
  }
};
