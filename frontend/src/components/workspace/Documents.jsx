import React, { useState, useEffect } from 'react';
import apiRequest from '../../utils/api.js';
import styles from './workspaceStyles';

export default function Documents({ project, onClose, token, colors }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const deleteDocument = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"? The AI will no longer use it for context.`)) return;
    setDeletingId(doc._id);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/documents/${doc._id}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setDocuments(prev => prev.filter(d => d._id !== doc._id));
      } else {
        alert(data.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/documents`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const uploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check for duplicate
    const isDuplicate = documents.some(doc => doc.title === file.name);
    if (isDuplicate) {
      alert(`A document named "${file.name}" already exists. Please rename the file or delete the existing document first.`);
      e.target.value = ''; // Reset file input
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const response = await apiRequest(
          `/api/projects/${project._id}/documents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              title: file.name,
              content: event.target.result,
              fileType: file.type || 'text/plain'
            })
          }
        );

        const data = await response.json();
        if (data.success) {
          loadDocuments();
        } else {
          alert(`Upload failed: ${data.error}`);
        }
      } catch (error) {
        console.error('Error uploading document:', error);
        alert('Failed to upload document. Please try again.');
      } finally {
        setUploading(false);
        e.target.value = ''; // Reset file input
      }
    };

    reader.readAsText(file);
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
        <h1 style={{...styles.pageTitle, color: colors.text}}>Documents</h1>
        <label htmlFor="file-upload" style={styles.uploadButton}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
          </svg>
          {uploading ? 'Uploading...' : 'Upload'}
        </label>
        <input
          id="file-upload"
          type="file"
          onChange={uploadDocument}
          accept=".txt,.md"
          style={{ display: 'none' }}
          disabled={uploading}
        />
      </div>

      <div className="page-content-responsive" style={styles.pageContent}>
        {documents.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{...styles.emptyText, color: colors.textSecondary}}>No documents uploaded yet</p>
            <p style={{...styles.emptyHint, color: colors.textTertiary}}>Upload .txt or .md files to provide context for AI</p>
          </div>
        ) : (
          <div style={styles.documentsList}>
            {documents.map(doc => {
              const contentSize = doc.content ? (doc.content.length / 1024).toFixed(1) : '0';
              const hasEmbeddings = doc.chunks && doc.chunks.length > 0;
              
              return (
                <div key={doc._id} style={{...styles.documentCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                  </svg>
                  <div style={styles.documentInfo}>
                    <div style={{...styles.documentName, color: colors.text}}>{doc.title}</div>
                    <div style={{...styles.documentMeta, color: colors.textSecondary}}>
                      {contentSize} KB • Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{
                      ...styles.documentMeta,
                      color: hasEmbeddings ? '#10b981' : '#f59e0b',
                      fontSize: '11px',
                      marginTop: '4px'
                    }}>
                      {hasEmbeddings ? '✓ Embeddings ready' : '⏳ Processing embeddings...'}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteDocument(doc)}
                    disabled={deletingId === doc._id}
                    title="Delete document"
                    style={{
                      marginLeft: 'auto', background: 'transparent',
                      border: `1px solid ${colors.border}`, borderRadius: '6px',
                      padding: '6px 8px', color: '#ef4444',
                      cursor: deletingId === doc._id ? 'wait' : 'pointer',
                      opacity: deletingId === doc._id ? 0.5 : 1
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
