import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import apiRequest from '../../utils/api.js';

export default function ProjectBriefTab({ project, token, colors }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchBrief();
  }, [project._id]);

  const fetchBrief = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/projects/${project._id}/brief`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.brief) {
        setBrief(data.brief);
        if (data.brief.isOutdatedFallback) {
          toast.warning("Failed to generate a fresh brief. Showing cached version.");
        }
      } else {
        toast.error(data.error || "Failed to load project brief.");
      }
    } catch (e) {
      console.error('Fetch brief error:', e);
      toast.error("Failed to load project brief.");
    } finally {
      setLoading(false);
    }
  };

  const regenerateBrief = async () => {
    setGenerating(true);
    try {
      const res = await apiRequest(`/api/projects/${project._id}/brief/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.brief) {
        setBrief(data.brief);
        toast.success("Project Brief regenerated successfully!");
      } else {
        toast.error(data.error || "Failed to regenerate brief.");
      }
    } catch (e) {
      console.error('Regenerate brief error:', e);
      toast.error("Failed to regenerate brief.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingWrap}>
        <div style={{...styles.spinner, borderTopColor: '#667eea'}} />
        <p style={{ color: colors.textSecondary }}>Synthesizing Project Brief...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={{ ...styles.title, color: colors.text }}>
            {project.title} — Project Brief
          </h2>
          {brief && (
            <p style={{ ...styles.timestamp, color: colors.textSecondary }}>
              Last generated: {new Date(brief.generatedAt).toLocaleString()}
              {brief.isOutdatedFallback && <span style={styles.outdatedBadge}> (Outdated)</span>}
            </p>
          )}
        </div>
        
        <button 
          onClick={regenerateBrief} 
          disabled={generating}
          style={{ 
            ...styles.regenerateBtn, 
            background: colors.primary, 
            color: '#fff',
            opacity: generating ? 0.7 : 1
          }}
        >
          {generating ? (
            <>
              <div style={{...styles.spinnerSmall, borderTopColor: '#fff'}} />
              Generating...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              Regenerate Brief
            </>
          )}
        </button>
      </div>

      <div style={{ ...styles.document, background: colors.surface, border: `1px solid ${colors.border}` }}>
        {!brief ? (
          <div style={styles.emptyState}>
            <p style={{ color: colors.textSecondary }}>No brief exists yet. Generate one!</p>
          </div>
        ) : (
          <div 
            className="markdown-body custom-brief-markdown" 
            style={{ color: colors.text }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(brief.content || '')) }}
          />
        )}
      </div>

      <style>{`
        .custom-brief-markdown {
          font-family: 'Inter', -apple-system, sans-serif;
          line-height: 1.6;
          font-size: 15px;
        }
        .custom-brief-markdown h1, .custom-brief-markdown h2, .custom-brief-markdown h3 {
          color: ${colors.text};
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .custom-brief-markdown h2 {
          margin-top: 2em;
          margin-bottom: 0.8em;
          font-size: 18px;
          border-bottom: 1px solid ${colors.border}60;
          padding-bottom: 8px;
        }
        .custom-brief-markdown h2:first-child {
          margin-top: 0;
        }
        .custom-brief-markdown h3 {
          font-size: 16px;
          margin-top: 1.5em;
          margin-bottom: 0.6em;
        }
        .custom-brief-markdown p {
          margin-bottom: 1.2em;
          color: ${colors.textSecondary};
        }
        .custom-brief-markdown ul, .custom-brief-markdown ol {
          margin-bottom: 1.2em;
          padding-left: 20px;
        }
        .custom-brief-markdown li {
          margin-bottom: 0.6em;
          color: ${colors.textSecondary};
        }
        .custom-brief-markdown strong {
          color: ${colors.text};
          font-weight: 600;
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 4px 0',
    letterSpacing: '-0.01em',
    fontFamily: "'Inter', sans-serif"
  },
  timestamp: {
    fontSize: '13px',
    margin: 0
  },
  outdatedBadge: {
    color: '#ef4444',
    fontWeight: '600'
  },
  regenerateBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'Inter', sans-serif"
  },
  document: {
    padding: '32px 40px',
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    boxShadow: '0 8px 32px -8px rgba(0,0,0,0.08)',
    minHeight: '400px'
  },
  emptyState: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px'
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '16px'
  },
  spinner: {
    width: '32px', height: '32px', borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)',
    animation: 'spin 0.8s linear infinite'
  },
  spinnerSmall: {
    width: '16px', height: '16px', borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.2)',
    animation: 'spin 0.8s linear infinite'
  }
};
