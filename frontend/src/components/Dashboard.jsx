import React, { useState, useEffect } from 'react';
import apiRequest from '../utils/api.js';

export default function Dashboard({ project, onClose, token, colors, onSourceClick }) {
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    loadDecisions();
  }, []);

  const loadDecisions = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/projects/${project._id}/decisions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDecisions(data.decisions);
      }
    } catch (e) {
      console.error('Decision load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredDecisions = searchQuery.trim()
    ? decisions.filter(d =>
        d.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.rationale && d.rationale.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.proposedBy?.username && d.proposedBy.username.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : decisions;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredDecisions.length / ITEMS_PER_PAGE);
  const paginatedDecisions = filteredDecisions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div style={{ ...styles.page, background: colors.background }}>
      <div className="dashboard-header" style={{ ...styles.header, background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
        <div style={styles.headerLeft}>
          <button onClick={onClose} style={{ ...styles.backBtn, border: `1px solid ${colors.border}`, color: colors.text }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 style={{ ...styles.title, color: colors.text }}>Project Memory</h1>
            <p style={{ ...styles.subtitle, color: colors.textSecondary }}>Decision Log for {project.title}</p>
          </div>
        </div>
        <button onClick={loadDecisions} style={{ ...styles.refreshBtn, background: `${colors.border}60`, color: colors.text }} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={loading ? { animation: 'spin 1s linear infinite' } : {}}>
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
          Refresh
        </button>
      </div>

      <div style={styles.accentLine} />

      <div className="dashboard-content" style={styles.content}>
        {/* Search input */}
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search decisions..."
            style={{
              ...styles.searchInput,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              color: colors.text
            }}
          />
        </div>

        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={{...styles.spinner, borderTopColor: '#667eea'}} />
            <p style={{ color: colors.textSecondary }}>Loading memories...</p>
          </div>
        ) : filteredDecisions.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: '32px', marginBottom: '16px' }}>💭</span>
            <h3 style={{ color: colors.text, margin: '0 0 8px 0' }}>
              {searchQuery ? 'No matching decisions' : 'No memory yet'}
            </h3>
            <p style={{ color: colors.textSecondary, margin: 0 }}>
              {searchQuery
                ? 'Try a different search term.'
                : 'Click the bookmark button on any chat message to save important project context here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="decision-grid" style={styles.decisionGrid}>
              {paginatedDecisions.map((decision) => (
                <div key={decision._id} style={{ ...styles.decisionCard, background: colors.surface, border: `1px solid ${colors.border}` }}>
                  <div style={styles.decisionHeader}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ ...styles.decisionBadge, background: '#10b98120', color: '#10b981' }}>Decision</div>
                      <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                        {new Date(decision.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    {(decision.sourceMessageId || decision.messageId) && (
                      <span
                        style={{ fontSize: '12px', color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }}
                        title="Go to source message"
                        onClick={() => {
                          const srcId = decision.sourceMessageId || decision.messageId;
                          if (onSourceClick) {
                            onSourceClick(decision.discussionId, srcId);
                          } else {
                            navigator.clipboard.writeText(srcId);
                          }
                        }}
                      >
                        Source
                      </span>
                    )}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <h3 style={{ ...styles.decisionText, color: colors.text }}>{decision.text}</h3>
                    
                    {decision.rationale && (
                      <p style={{ ...styles.decisionRationale, color: colors.textSecondary }}>
                        💡 {decision.rationale}
                      </p>
                    )}
                  </div>
                  
                  <div style={{ ...styles.decisionFooter, borderTop: `1px solid ${colors.border}` }}>
                    <span style={{ color: colors.textSecondary }}>Proposed by <strong style={{ color: colors.text }}>{decision.proposedBy?.username || 'Unknown'}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination-responsive" style={styles.pagination}>
                <button
                  style={{ ...styles.pageBtn, background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, opacity: currentPage === 1 ? 0.5 : 1 }}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span style={{ color: colors.textSecondary, fontSize: '14px' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  style={{ ...styles.pageBtn, background: colors.surface, color: colors.text, border: `1px solid ${colors.border}`, opacity: currentPage === totalPages ? 0.5 : 1 }}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
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
    padding: '32px', maxWidth: '1000px', margin: '0 auto'
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  },
  loadingWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '400px', gap: '16px'
  },
  spinner: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)',
    animation: 'spin 0.8s linear infinite'
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '64px', textAlign: 'center',
    borderRadius: '12px', background: 'rgba(0,0,0,0.02)'
  },
  decisionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '20px'
  },
  decisionCard: {
    borderRadius: '12px', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    transition: 'transform 0.2s',
    height: '100%',
    boxSizing: 'border-box'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '32px'
  },
  pageBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s'
  },
  decisionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  decisionBadge: {
    fontSize: '11px', fontWeight: '600', padding: '4px 8px',
    borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
  },
  decisionText: {
    fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0', lineHeight: '1.4'
  },
  decisionRationale: {
    fontSize: '14px', margin: 0, lineHeight: '1.5'
  },
  decisionFooter: {
    paddingTop: '12px', marginTop: '4px', fontSize: '13px',
    display: 'flex', alignItems: 'center'
  }
};
