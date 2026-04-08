import React from 'react';

const SEVERITY_CONFIG = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: 'High' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'Med' },
  low:    { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', label: 'Low' }
};

export default function BlockerTracker({ enrichedBlockers, colors }) {
  if (!enrichedBlockers?.length) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: colors.textSecondary }}>
        No open blockers
      </div>
    );
  }

  // Filter out resolved, sort by severity then daysOpen
  const severityOrder = { high: 0, medium: 1, low: 2 };
  const open = enrichedBlockers
    .filter(b => !b.resolved)
    .sort((a, b) => {
      const sA = severityOrder[a.severity] ?? 1;
      const sB = severityOrder[b.severity] ?? 1;
      if (sA !== sB) return sA - sB;
      return (b.daysOpen || 0) - (a.daysOpen || 0);
    });

  if (!open.length) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: '#10b981' }}>
        ✓ No open blockers
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {open.map((b, i) => {
        const cfg = SEVERITY_CONFIG[b.severity] || SEVERITY_CONFIG.medium;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px',
              background: colors.background,
              border: `1px solid ${colors.border}`,
              borderLeft: `3px solid ${cfg.color}`,
              borderRadius: '6px'
            }}
          >
            {/* Severity badge */}
            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              color: cfg.color,
              background: cfg.bg,
              padding: '2px 6px',
              borderRadius: '4px',
              flexShrink: 0,
              marginTop: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {cfg.label}
            </span>

            {/* Text + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', color: colors.text, lineHeight: '1.4' }}>
                {b.text}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                {b.topicName && (
                  <span style={{
                    fontSize: '11px',
                    color: '#8b5cf6',
                    background: 'rgba(139,92,246,0.1)',
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    {b.topicName}
                  </span>
                )}
                {b.daysOpen > 0 && (
                  <span style={{
                    fontSize: '11px',
                    color: b.daysOpen >= 5 ? '#ef4444' : colors.textTertiary
                  }}>
                    {b.daysOpen}d open
                  </span>
                )}
                {b.proposedBy && b.proposedBy !== 'User' && (
                  <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                    — raised by {b.proposedBy}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
