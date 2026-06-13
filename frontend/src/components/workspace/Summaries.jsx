import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/api.js';
import styles from './workspaceStyles';

export default function Summaries({ project, discussion, onClose, token, colors }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingSummary, setEditingSummary] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/summaries`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        // Filter summaries for current discussion
        const discSummaries = data.summaries.filter(
          s => s.discussionId === discussion._id
        );
        setSummaries(discSummaries);
      }
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async (prompt = null) => {
    setGenerating(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussion._id}/summarize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ customPrompt: prompt })
        }
      );
      const data = await response.json();
      if (data.success) {
        loadSummaries();
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setGenerating(false);
    }
  };

  const regenerateSummary = async (summaryId) => {
    if (!customPrompt.trim()) {
      toast.warning('Please enter refinement instructions');
      return;
    }

    setRegenerating(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussion._id}/summaries/${summaryId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ customPrompt })
        }
      );
      const data = await response.json();
      if (data.success) {
        setEditingSummary(null);
        setCustomPrompt('');
        loadSummaries();
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const deleteSummary = async (summaryId) => {
    if (!confirm('Delete this summary?')) return;

    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussion._id}/summaries/${summaryId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        loadSummaries();
      }
    } catch (error) {
      console.error('Error deleting summary:', error);
    }
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
        <h1 style={{...styles.pageTitle, color: colors.text}}>Summaries - {discussion.title}</h1>
        <button 
          onClick={() => generateSummary()} 
          style={styles.uploadButton}
          disabled={generating}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      <div className="page-content-responsive" style={styles.pageContent}>
        {loading ? (
          <div style={styles.emptyState}>
            <p style={{...styles.emptyText, color: colors.textSecondary}}>Loading summaries...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{...styles.emptyText, color: colors.textSecondary}}>No summaries yet</p>
            <p style={{...styles.emptyHint, color: colors.textTertiary}}>Generate a summary to capture key points from this discussion</p>
          </div>
        ) : (
          <div style={styles.summariesList}>
            {summaries.map(summary => (
              <div key={summary._id} style={{...styles.summaryCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <div style={styles.summaryHeader}>
                  <div style={styles.summaryMeta}>
                    <span style={{...styles.summaryDate, color: colors.text}}>
                      {new Date(summary.createdAt).toLocaleDateString()}
                    </span>
                    <span style={{...styles.summaryProvider, color: colors.textSecondary}}>
                      via {summary.generatedBy}
                    </span>
                  </div>
                  <div style={styles.summaryActions}>
                    <button 
                      onClick={() => setEditingSummary(summary._id)}
                      style={{...styles.summaryActionBtn, color: colors.text}}
                      title="Refine summary"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button 
                      onClick={() => deleteSummary(summary._id)}
                      style={{...styles.summaryActionBtn, color: '#ef4444'}}
                      title="Delete summary"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div style={{...styles.summaryContent, color: colors.text}}>
                  {summary.content}
                </div>

                {editingSummary === summary._id && (
                  <div style={styles.refineBox}>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="How would you like to refine this summary? (e.g., 'Make it more concise', 'Focus on technical decisions', 'Add action items')"
                      style={styles.refineInput}
                      rows={3}
                    />
                    <div style={styles.refineActions}>
                      <button 
                        onClick={() => {
                          setEditingSummary(null);
                          setCustomPrompt('');
                        }}
                        style={styles.refineCancelBtn}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => regenerateSummary(summary._id)}
                        style={styles.refineSubmitBtn}
                        disabled={regenerating || !customPrompt.trim()}
                      >
                        {regenerating ? 'Refining...' : 'Refine Summary'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
