import React from 'react';

const STAGE_COLORS = {
  ideation: '#8b5cf6',
  design: '#3b82f6',
  discussion: '#10b981',
  blocked: '#ef4444',
  completed: '#06b6d4'
};

const TREND_ICONS = {
  rising: '↑',
  stable: '→',
  falling: '↓'
};

const TREND_COLORS = {
  rising: '#10b981',
  stable: '#f59e0b',
  falling: '#ef4444'
};

export default function ProjectIntelligenceCard({ projectState, colors }) {
  if (!projectState) return null;

  const {
    stage = 'ideation',
    stageReason,
    momentum,
    openBlockerCount = 0,
    unresolvedActionCount = 0,
    activeTopicCount = 0,
    lastDecisionAt
  } = projectState;

  const stageColor = STAGE_COLORS[stage] || '#6b7280';
  const trend = momentum?.trend || 'stable';
  const trendColor = TREND_COLORS[trend];
  const trendIcon = TREND_ICONS[trend];
  const msgsPerWeek = momentum?.recentMessageCount ?? 0;

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: '10px',
      padding: '20px',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: colors.text, margin: 0 }}>
          Project Intelligence
        </h3>
        <span style={{
          fontSize: '12px',
          fontWeight: '600',
          color: stageColor,
          background: `${stageColor}18`,
          padding: '4px 10px',
          borderRadius: '20px',
          textTransform: 'capitalize'
        }}>
          {stage}
        </span>
      </div>

      {stageReason && (
        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '16px', fontStyle: 'italic' }}>
          {stageReason}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {/* Momentum */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: trendColor }}>
            {trendIcon} {msgsPerWeek}
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            msgs/week
          </div>
        </div>

        {/* Open Blockers */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: openBlockerCount > 0 ? '#ef4444' : '#10b981' }}>
            {openBlockerCount}
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            blockers
          </div>
        </div>

        {/* Pending Actions */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: colors.text }}>
            {unresolvedActionCount}
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            actions
          </div>
        </div>

        {/* Active Topics */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: colors.text }}>
            {activeTopicCount}
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            topics
          </div>
        </div>
      </div>

      {lastDecisionAt && (
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${colors.border}`, fontSize: '12px', color: colors.textSecondary }}>
          Last decision: {formatDate(lastDecisionAt)}
        </div>
      )}
    </div>
  );
}
