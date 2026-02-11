import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ProjectList({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { token, user, logout } = useAuth();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/projects', {
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
    <div style={styles.container}>
      {/* Icon Bar (always visible) */}
      <div style={styles.iconBar}>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)} 
          style={styles.iconBarBtn}
          title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 3v18"/>
          </svg>
        </button>

        {!sidebarOpen && (
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

            <div style={styles.iconBarUser}>
              {user?.username?.charAt(0).toUpperCase()}
            </div>
          </>
        )}
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <button onClick={() => setShowCreateModal(true)} style={styles.newProjectBtn}>
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
                style={styles.projectItem}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span style={styles.projectTitle}>{project.title}</span>
              </div>
            ))}
          </div>

          <div style={styles.sidebarFooter}>
            <button onClick={() => setShowJoinModal(true)} style={styles.footerBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <line x1="20" y1="8" x2="20" y2="14"/>
                <line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              Join project
            </button>
            
            <div style={styles.userSection}>
              <div style={styles.userAvatar}>
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div style={styles.userInfo}>
                <div style={styles.userName}>{user?.username}</div>
                <button onClick={logout} style={styles.logoutBtn}>Log out</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{...styles.main, marginLeft: sidebarOpen ? '308px' : '48px'}}>

        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h2 style={styles.emptyTitle}>CollabAI Workspace</h2>
          <p style={styles.emptyText}>
            Create a project to start collaborating with your team and AI
          </p>
          <div style={styles.emptyActions}>
            <button onClick={() => setShowCreateModal(true)} style={styles.primaryBtn}>
              Create new project
            </button>
            <button onClick={() => setShowJoinModal(true)} style={styles.secondaryBtn}>
              Join existing project
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal 
          token={token}
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

function CreateProjectModal({ token, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8080/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, problemStatement })
      });

      const data = await response.json();
      if (data.success) {
        onCreated(data.project);
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Create new project</h2>
          <button onClick={onClose} style={styles.modalClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.modalForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Project title</label>
            <input
              type="text"
              placeholder="e.g., Product Launch Planning"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              required
              autoFocus
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Problem statement</label>
            <textarea
              placeholder="Describe what you're trying to solve..."
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              style={{...styles.input, minHeight: '120px', resize: 'vertical'}}
              required
            />
          </div>

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Creating...' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinProjectModal({ token, onClose, onJoined }) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8080/api/projects/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inviteCode })
      });

      const data = await response.json();
      if (data.success) {
        onJoined();
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to join project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Join project</h2>
          <button onClick={onClose} style={styles.modalClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={styles.modalForm}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Invite code</label>
            <input
              type="text"
              placeholder="Enter 8-character code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              style={styles.input}
              required
              autoFocus
              maxLength={8}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={styles.cancelBtn}>
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
    background: '#343541',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  iconBar: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '48px',
    height: '100vh',
    background: '#171717',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    gap: '8px',
    zIndex: 200,
    borderRight: '1px solid rgba(255,255,255,0.1)'
  },
  iconBarBtn: {
    width: '40px',
    height: '40px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#8e8ea0',
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
    background: '#5436da',
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
    background: '#202123',
    zIndex: 150,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid rgba(255,255,255,0.1)'
  },
  sidebarHeader: {
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  newProjectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#ececf1',
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
    color: '#ececf1',
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
    borderTop: '1px solid #4d4d4f',
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
    color: '#ececf1',
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
    background: '#5436da',
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
    color: '#ececf1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  logoutBtn: {
    background: 'none',
    border: 'none',
    color: '#8e8ea0',
    fontSize: '12px',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit'
  },
  toggleBtn: {
    position: 'fixed',
    left: '16px',
    top: '16px',
    background: '#202123',
    border: '1px solid #4d4d4f',
    borderRadius: '8px',
    padding: '8px',
    color: '#ececf1',
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
    color: '#ececf1',
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
    color: '#565869',
    marginBottom: '24px'
  },
  emptyTitle: {
    fontSize: '32px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#ececf1'
  },
  emptyText: {
    fontSize: '16px',
    color: '#8e8ea0',
    marginBottom: '32px',
    lineHeight: '1.6'
  },
  emptyActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  primaryBtn: {
    padding: '12px 24px',
    background: '#10a37f',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
    fontFamily: 'inherit'
  },
  secondaryBtn: {
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid hsla(0,0%,100%,.2)',
    borderRadius: '8px',
    color: '#ececf1',
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
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modal: {
    background: '#343541',
    borderRadius: '12px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #4d4d4f'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ececf1'
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#8e8ea0',
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
    color: '#ececf1',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px',
    background: '#40414f',
    border: '1px solid #565869',
    borderRadius: '8px',
    color: '#ececf1',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  error: {
    padding: '12px',
    background: '#f87171',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px'
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
    border: '1px solid #565869',
    borderRadius: '8px',
    color: '#ececf1',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  submitBtn: {
    padding: '10px 20px',
    background: '#10a37f',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit'
  }
};
