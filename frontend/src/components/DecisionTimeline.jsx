import React, { useState } from 'react';

export default function DecisionTimeline({ enrichedDecisions, colors }) {
  const [expanded, setExpanded] = useState(null);

  if (!enrichedDecisions?.length) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontSize: '14px', color: colors.textSecondary }}>
        No decisions recorded yet
      </div>
    );
  }

  const sorted = [...enrichedDecisions]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {sorted.map((d, i) => {
        const isExpanded = expanded === i;
        const hasDetail = d.rationale || d.topicName;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '12px',
              paddingBottom: '16px',
              position: 'relative'
            }}
          >
            {/* Timeline line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10b981',
                marginTop: '4px',
                flexShrink: 0
              }} />
              {i < sorted.length - 1 && (
                <div style={{ width: '2px', flex: 1, background: colors.border, marginTop: '4px' }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  color: colors.text,
                  fontWeight: '500',
                  lineHeight: '1.4',
                  cursor: hasDetail ? 'pointer' : 'default'
                }}
                onClick={() => hasDetail && setExpanded(isExpanded ? null : i)}
              >
                {d.text}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                {d.topicName && (
                  <span style={{
                    fontSize: '11px',
                    color: '#8b5cf6',
                    background: 'rgba(139,92,246,0.1)',
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    {d.topicName}
                  </span>
                )}
                {d.timestamp && (
                  <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                    {formatDate(d.timestamp)}
                  </span>
                )}
                {d.proposedBy && d.proposedBy !== 'User' && (
                  <span style={{ fontSize: '11px', color: colors.textTertiary }}>
                    — raised by {d.proposedBy}
                  </span>
                )}
                {hasDetail && (
                  <span style={{ fontSize: '11px', color: colors.textTertiary, cursor: 'pointer' }}
                    onClick={() => setExpanded(isExpanded ? null : i)}>
                    {isExpanded ? '▲ less' : '▼ more'}
                  </span>
                )}
              </div>

              {isExpanded && d.rationale && (
                <div style={{
                  marginTop: '8px',
                  padding: '10px',
                  background: colors.background,
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: colors.textSecondary,
                  lineHeight: '1.5',
                  border: `1px solid ${colors.border}`
                }}>
                  {d.rationale}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
