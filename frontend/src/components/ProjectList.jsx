import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Sidebar from './Sidebar';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import { toast } from 'react-toastify';
import apiRequest from '../utils/api.js';

export default function ProjectList({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { token, user } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await apiRequest('/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  return (
    <div style={{...styles.container, background: colors.background}}>
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        iconBarContent={
          <>
            <button 
              onClick={() => setShowCreateModal(true)} 
              style={styles.iconBarBtn}
              title="New project"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>

            <div style={{ flex: 1 }}></div>

            <div style={{
              ...styles.iconBarUser,
              background: getAvatarColor(user?.username)
            }}>
              {getInitials(user?.username)}
            </div>
          </>
        }
        footerContent={
          <button onClick={() => setShowJoinModal(true)} style={{...styles.footerBtn, color: colors.text}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Join project
          </button>
        }
      >
        <div style={{...styles.sidebarHeader, borderBottom: `1px solid ${colors.border}`}}>
          <button onClick={() => setShowCreateModal(true)} style={{...styles.newProjectBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>New project</span>
          </button>
        </div>

        <div style={styles.projectsList}>
          {projects.map(project => (
            <div
              key={project._id}
              onClick={() => onSelectProject(project)}
              style={{...styles.projectItem, color: colors.text}}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span style={styles.projectTitle}>{project.title}</span>
            </div>
          ))}
        </div>
      </Sidebar>

      {/* Main content */}
      <div className="main-workspace" style={{...styles.main, marginLeft: sidebarOpen ? '308px' : '48px', minWidth: 0}}>

        <div style={styles.emptyState}>
          <div style={{...styles.emptyIcon, color: colors.textTertiary}}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h2 style={{...styles.emptyTitle, color: colors.text}}>CollabAI Workspace</h2>
          <p style={{...styles.emptyText, color: colors.textSecondary}}>
            Create a project to start collaborating with your team and AI
          </p>
          <div style={styles.emptyActions}>
            <button onClick={() => setShowCreateModal(true)} style={styles.primaryBtn}>
              Create new project
            </button>
            <button onClick={() => setShowJoinModal(true)} style={{...styles.secondaryBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
              Join existing project
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal 
          token={token}
          colors={colors}
          onClose={() => setShowCreateModal(false)}
          onCreated={(project) => {
            setShowCreateModal(false);
            loadProjects();
            onSelectProject(project);
          }}
        />
      )}

      {showJoinModal && (
        <JoinProjectModal 
          token={token}
          colors={colors}
          onClose={() => setShowJoinModal(false)}
          onJoined={() => {
            setShowJoinModal(false);
            loadProjects();
          }}
        />
      )}
    </div>
  );
}

function CreateProjectModal({ token, colors, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdProject, setCreatedProject] = useState(null);
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiRequest('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, problemStatement })
      });

      const data = await response.json();
      if (data.success) {
        setCreatedProject(data.project);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInviteEmail = async () => {
    if (!emailInput.trim()) {
      toast.warning('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await fetch(
        `/api/projects/${createdProject._id}/invite-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ email: emailInput.trim() })
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success(`Invitation sent to ${emailInput}!`);
        setEmailInput('');
      } else {
        toast.error(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send invitation. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDone = () => {
    onCreated(createdProject);
    onClose();
  };

  return (
    <div style={styles.modalOverlay} onClick={createdProject ? null : onClose}>
      <div style={{...styles.modal, background: colors.surface, border: `1px solid ${colors.border}`}} onClick={(e) => e.stopPropagation()}>
        {!createdProject ? (
          <>
            <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
              <h2 style={{...styles.modalTitle, color: colors.text}}>Create new project</h2>
              <button onClick={onClose} style={{...styles.modalClose, color: colors.textTertiary}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={styles.modalForm}>
              <div style={styles.formGroup}>
                <label style={{...styles.label, color: colors.text}}>Project title</label>
                <input
                  type="text"
                  placeholder="e.g., Product Launch Planning"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{...styles.input, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text}}
                  required
                  autoFocus
                />
              </div>

              <div style={styles.formGroup}>
                <label style={{...styles.label, color: colors.text}}>Problem statement</label>
                <textarea
                  placeholder="Describe what you're trying to solve..."
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  style={{...styles.input, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text, minHeight: '120px', resize: 'vertical'}}
                  required
                />
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={onClose} style={{...styles.cancelBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn} disabled={loading}>
                  {loading ? 'Creating...' : 'Create project'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
              <div style={styles.successIcon}>✓</div>
              <h2 style={{...styles.modalTitle, color: colors.text}}>Project Created!</h2>
            </div>
            
            <div style={styles.modalForm}>
              <p style={{...styles.successMessage, color: colors.text}}>
                Your project "{createdProject.title}" has been created successfully.
              </p>

              <div style={{...styles.inviteSection, background: colors.background, border: `1px solid ${colors.border}`}}>
                <h3 style={{...styles.inviteTitle, color: colors.text}}>Invite Team Members</h3>
                <p style={{...styles.inviteDesc, color: colors.textSecondary}}>
                  Share this link with your team members to collaborate:
                </p>
                
                <div style={{...styles.inviteCodeBox, background: colors.background, border: `1px solid ${colors.border}`}}>
                  <code style={styles.inviteCode}>
                    {window.location.origin}/join/{createdProject.inviteCode}
                  </code>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join/${createdProject.inviteCode}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{...styles.copyBtn, border: `1px solid ${colors.border}`, color: colors.text}}
                    title="Copy invite link"
                  >
                    {copied ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    )}
                  </button>
                </div>

                <div style={{...styles.inviteHint, color: colors.textTertiary}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  <span>Anyone with this link can join your project</span>
                </div>

                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${colors.border}` }}>
                  <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '12px' }}>
                    Or send invitation via email:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="email"
                      placeholder="teammate@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      style={{
                        ...styles.input,
                        background: colors.background,
                        border: `1px solid ${colors.border}`,
                        color: colors.text,
                        flex: 1,
                        marginBottom: 0
                      }}
                    />
                    <button
                      onClick={handleSendInviteEmail}
                      disabled={sendingEmail || !emailInput.trim()}
                      style={{
                        ...styles.submitBtn,
                        padding: '12px 20px',
                        opacity: sendingEmail || !emailInput.trim() ? 0.5 : 1
                      }}
                    >
                      {sendingEmail ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={styles.modalActions}>
                <button onClick={handleDone} style={styles.submitBtn}>
                  Start Collaborating
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JoinProjectModal({ token, colors, onClose, onJoined }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [joinedProject, setJoinedProject] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiRequest('/api/projects/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inviteCode })
      });

      const data = await response.json();
      if (data.success) {
        setJoinedProject(data.project);
        setSuccess(true);
        // Immediately reload projects in parent
        onJoined();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Failed to join project');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    onJoined();
    onClose();
  };

  if (success && joinedProject) {
    return (
      <div style={styles.modalOverlay} onClick={handleSuccess}>
        <div style={{
          ...styles.modal,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          textAlign: 'center',
          padding: '40px'
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(16, 163, 127, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10a37f',
            margin: '0 auto 24px',
            animation: 'scaleIn 0.4s ease-out'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: colors.text, marginBottom: '12px' }}>
            Welcome to the Team!
          </h2>
          <p style={{ fontSize: '16px', color: colors.textSecondary, lineHeight: '1.6', marginBottom: '32px' }}>
            You've successfully joined "{joinedProject.title}". Start collaborating with your team now!
          </p>
          <button onClick={handleSuccess} style={{
            ...styles.submitBtn,
            width: '100%',
            background: '#10a37f'
          }}>
            Start Collaborating
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{...styles.modal, background: colors.surface, border: `1px solid ${colors.border}`}} onClick={(e) => e.stopPropagation()}>
        <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
          <h2 style={{...styles.modalTitle, color: colors.text}}>Join project</h2>
          <button onClick={onClose} style={{...styles.modalClose, color: colors.textTertiary}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.modalForm}>
          <div style={styles.formGroup}>
            <label style={{...styles.label, color: colors.text}}>Invite code</label>
            <input
              type="text"
              placeholder="Enter 8-character code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              style={{...styles.input, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text}}
              required
              autoFocus
              maxLength={8}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={{...styles.cancelBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Joining...' : 'Join project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  iconBar: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '48px',
    height: '100vh',
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    gap: '8px',
    zIndex: 200,
    borderRight: '1px solid #2d2d2d'
  },
  iconBarBtn: {
    width: '40px',
    height: '40px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#6b6b6b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  iconBarUser: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600'
  },
  sidebar: {
    position: 'fixed',
    left: '48px',
    top: 0,
    width: '260px',
    height: '100vh',
    background: '#171717',
    zIndex: 150,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #2d2d2d'
  },
  sidebarHeader: {
    padding: '12px'
  },
  newProjectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  projectsList: {
    flex: 1,
    overflowY: 'auto',
    marginTop: '8px'
  },
  projectItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    fontSize: '14px',
    marginBottom: '2px'
  },
  projectTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  sidebarFooter: {
    borderTop: '1px solid #2d2d2d',
    paddingTop: '12px',
    marginTop: '12px'
  },
  footerBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.2s',
    fontFamily: 'inherit',
    marginBottom: '8px'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '8px',
    background: 'transparent'
  },
  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    background: '#8b5cf6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
  },
  userInfo: {
    flex: 1,
    minWidth: 0
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececec',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: '#6b6b6b',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    transition: 'color 0.2s'
  },
  toggleBtn: {
    position: 'fixed',
    left: '16px',
    top: '16px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    padding: '8px',
    color: '#ececec',
    cursor: 'pointer',
    zIndex: 101,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'margin-left 0.3s ease',
    position: 'relative'
  },
  closeSidebarBtn: {
    position: 'absolute',
    left: '16px',
    top: '16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    padding: '8px',
    color: '#ececec',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyState: {
    textAlign: 'center',
    maxWidth: '600px',
    padding: '40px'
  },
  emptyIcon: {
    marginBottom: '24px'
  },
  emptyTitle: {
    fontSize: '32px',
    fontWeight: '600',
    marginBottom: '16px',
    wordBreak: 'break-word'
  },
  emptyText: {
    fontSize: '16px',
    marginBottom: '32px',
    lineHeight: '1.6'
  },
  emptyActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  primaryBtn: {
    padding: '12px 24px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  secondaryBtn: {
    padding: '12px 24px',
    background: 'transparent',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
    fontFamily: 'inherit'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
    boxSizing: 'border-box'
  },
  modal: {
    borderRadius: '12px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    boxSizing: 'border-box'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600'
  },
  modalClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalForm: {
    padding: '24px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  error: {
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  },
  cancelBtn: {
    padding: '10px 20px',
    background: 'transparent',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  submitBtn: {
    padding: '10px 20px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  successIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(139, 92, 246, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#8b5cf6',
    margin: '0 auto 16px'
  },
  successMessage: {
    fontSize: '15px',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  inviteSection: {
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px'
  },
  inviteTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '8px'
  },
  inviteDesc: {
    fontSize: '14px',
    marginBottom: '16px',
    lineHeight: '1.5'
  },
  inviteCodeBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '12px'
  },
  inviteCode: {
    flex: 1,
    fontSize: '14px',
    fontWeight: '500',
    color: '#8b5cf6',
    fontFamily: 'monospace',
    wordBreak: 'break-all'
  },
  copyBtn: {
    padding: '8px',
    background: 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  inviteHint: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: '13px',
    lineHeight: '1.4'
  }
};
