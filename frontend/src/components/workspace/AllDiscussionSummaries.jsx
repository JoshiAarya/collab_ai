import React, { useState, useEffect } from 'react';
import apiRequest from '../../utils/api.js';
import styles from './workspaceStyles';

export default function AllDiscussionSummaries({ project, discussions, onClose, token, colors }) {
  const [summariesByDisc, setSummariesByDisc] = useState({});
  const [loading, setLoading] = useState(true);

  const parallelDiscussions = discussions.filter(d => !d.isMain);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/summaries`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        // Group by discussionId
        const grouped = {};
        data.summaries.forEach(s => {
          const key = s.discussionId;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(s);
        });
        setSummariesByDisc(grouped);
      }
    } catch (err) {
      console.error('Error loading all summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const relativeTime = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{...styles.fullPage, background: colors.background}}>
      <div className="page-header-responsive" style={{...styles.pageHeader, background: colors.surface, borderBottom: `1px solid ${colors.border}`}}>
        <button onClick={onClose} style={{...styles.backButton, border: `1px solid ${colors.border}`, color: colors.text}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 style={{...styles.pageTitle, color: colors.text}}>Discussion Summaries</h1>
        <div style={{ width: '100px' }} />
      </div>

      <div className="page-content-responsive" style={styles.pageContent}>
        {loading ? (
          <div style={styles.emptyState}>
            <p style={{color: colors.textSecondary}}>Loading...</p>
          </div>
        ) : parallelDiscussions.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{color: colors.textSecondary}}>No parallel discussions yet</p>
          </div>
        ) : (
          <div style={styles.summariesList}>
            {parallelDiscussions.map(disc => {
              const discSummaries = summariesByDisc[disc._id] || [];
              const msgCount = disc.messageCount || 0;
              const latestSummary = discSummaries[0];
              const isStaleSummary = latestSummary && (msgCount - (latestSummary.messageCountAtSummary || 0)) >= 10;

              return (
                <div key={disc._id} style={{...styles.summaryCard, background: colors.surface, border: `1px solid ${colors.border}`, marginBottom: '20px'}}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span style={{ color: colors.text, fontWeight: '600', fontSize: '15px' }}>{disc.title}</span>
                      {isStaleSummary && (
                        <span title="Summary may be outdated — discussion has grown significantly" style={{ fontSize: '13px' }}>⚠️ stale</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: colors.textTertiary }}>
                      {msgCount > 0 && <span>{msgCount} messages</span>}
                      {disc.lastActivity && <span>active {relativeTime(disc.lastActivity)}</span>}
                    </div>
                  </div>

                  {discSummaries.length === 0 ? (
                    <p style={{ color: colors.textTertiary, fontSize: '13px', fontStyle: 'italic' }}>No summary yet</p>
                  ) : (
                    discSummaries.map(s => (
                      <div key={s._id} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${colors.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                            {new Date(s.createdAt).toLocaleDateString()} · via {s.generatedBy}
                          </span>
                          {s.messageCountAtSummary > 0 && (
                            <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                              at {s.messageCountAtSummary} messages
                            </span>
                          )}
                        </div>
                        <div style={{ color: colors.text, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                          {s.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
