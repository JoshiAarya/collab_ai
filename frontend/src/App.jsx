import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Auth from './components/Auth';
import ProjectList from './components/ProjectList';
import ProjectWorkspace from './components/ProjectWorkspace';
import Onboarding from './components/Onboarding';
import ErrorBoundary from './components/shared/ErrorBoundary';
import apiRequest from './utils/api.js';
import { getInviteCodeFromUrl, getDiscussionInviteFromUrl, clearUrl } from './utils/router';

function AppContent() {
  const { user, loading, refreshAuth, token } = useAuth();
  const [selectedProject, setSelectedProject] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [inviteCode, setInviteCode] = useState(null);
  const [discussionId, setDiscussionId] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [oauthHandled, setOauthHandled] = useState(false);

  // Check for invite link in URL
  useEffect(() => {
    const code = getInviteCodeFromUrl();
    const discussion = getDiscussionInviteFromUrl();
    if (code) {
      setInviteCode(code);
      if (discussion) {
        setDiscussionId(discussion);
      }
    }
  }, []);

  // Auto-join project if user is logged in and has invite code
  useEffect(() => {
    if (user && inviteCode && token && !isJoining && !showInviteModal) {
      // Fetch project info first to show in modal
      fetchInviteProjectInfo();
    }
  }, [user, inviteCode, token]);

  const fetchInviteProjectInfo = async () => {
    try {
      // We need to get project info without joining first
      // For now, just show the modal - we'll fetch details in the modal
      setShowInviteModal(true);
    } catch (error) {
      console.error('Error fetching invite info:', error);
      // If we can't fetch, just show modal anyway
      setShowInviteModal(true);
    }
  };

  const handleAutoJoin = async () => {
    // Prevent multiple calls
    if (isJoining) return;
    
    setIsJoining(true);
    
    try {
      const requestBody = { inviteCode };
      
      // If there's a discussion ID, include it in the request
      if (discussionId) {
        requestBody.discussionId = discussionId;
      }
      
      const response = await apiRequest('/api/projects/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      if (data.success) {
        clearUrl();
        setInviteCode(null);
        setShowInviteModal(false);
        
        // Show appropriate success message
        if (discussionId) {
          if (data.alreadyMember && data.addedToDiscussion) {
            toast.success(`Added to discussion in "${data.project.title}"!`);
          } else if (data.alreadyMember) {
            toast.success(`Opened "${data.project.title}"`);
          } else {
            toast.success(`Joined "${data.project.title}" and added to discussion!`);
          }
          
          // Store discussion ID for navigation
          sessionStorage.setItem('pendingDiscussionId', data.discussionId || discussionId);
          setDiscussionId(null);
          
          // For discussion invites, open the project workspace directly
          setSelectedProject(data.project);
        } else {
          // Project invite - stay on project list
          if (data.alreadyMember) {
            toast.info(`You're already a member of "${data.project.title}"`);
          } else {
            toast.success(`Joined "${data.project.title}" successfully!`);
          }
        }
      } else {
        toast.error(data.error || 'Failed to join project');
        clearUrl();
        setInviteCode(null);
        setDiscussionId(null);
        setShowInviteModal(false);
      }
    } catch {
      toast.error('Failed to join project');
      clearUrl();
      setInviteCode(null);
      setDiscussionId(null);
      setShowInviteModal(false);
    } finally {
      setIsJoining(false);
    }
  };

  const handleDeclineInvite = () => {
    clearUrl();
    setInviteCode(null);
    setDiscussionId(null);
    setShowInviteModal(false);
    toast.info('Invite declined');
  };

  // Check if user needs onboarding
  useEffect(() => {
    if (user && !localStorage.getItem('onboarding-completed') && !inviteCode) {
      console.log('Showing onboarding for new user');
      setShowOnboarding(true);
    }
  }, [user, inviteCode]);

  // Handle OAuth callback — token arrives in the URL fragment (never sent to
  // servers), error arrives as a query param.
  useEffect(() => {
    if (oauthHandled) return;

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const token = hashParams.get('token');
    const provider = hashParams.get('provider');
    const error = searchParams.get('error');

    if (error) {
      toast.error('Authentication failed. Please try again.');
      window.history.replaceState({}, document.title, window.location.pathname);
      setOauthHandled(true);
    } else if (token && provider) {
      // Store token
      localStorage.setItem('collab-ai-token', token);
      // Clean URL (drops the fragment)
      window.history.replaceState({}, document.title, window.location.pathname);
      setOauthHandled(true);
      // Trigger auth refresh
      refreshAuth().then(() => {
        toast.success(`Welcome! Signed in with ${provider}`);
      });
    }
  }, [toast, oauthHandled, refreshAuth]);

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingSpinner}></div>
        <div style={styles.loadingText}>Loading...</div>
      </div>
    );
  }

  // If not logged in but has invite code, show login with message
  if (!user) {
    if (inviteCode) {
      return (
        <div>
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #2d2d2d',
            borderRadius: '8px',
            padding: '16px',
            margin: '20px auto',
            maxWidth: '420px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#10a37f', fontSize: '14px', marginBottom: '8px' }}>
              🎉 You've been invited to join a project!
            </p>
            <p style={{ color: '#b4b4b4', fontSize: '13px' }}>
              Please log in or create an account to continue
            </p>
          </div>
          <Auth />
        </div>
      );
    }
    return <Auth />;
  }

  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }

  if (selectedProject) {
    return (
      <>
        <ProjectWorkspace 
          project={selectedProject} 
          onBack={() => setSelectedProject(null)} 
        />
        {showInviteModal && (
          <InviteConfirmModal
            inviteCode={inviteCode}
            discussionId={discussionId}
            token={token}
            onAccept={handleAutoJoin}
            onDecline={handleDeclineInvite}
            isJoining={isJoining}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ProjectList onSelectProject={setSelectedProject} />
      {showInviteModal && (
        <InviteConfirmModal
          inviteCode={inviteCode}
          discussionId={discussionId}
          token={token}
          onAccept={handleAutoJoin}
          onDecline={handleDeclineInvite}
          isJoining={isJoining}
        />
      )}
    </>
  );
}

function InviteConfirmModal({ inviteCode, discussionId, token, onAccept, onDecline, isJoining }) {
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInviteInfo();
  }, []);

  const fetchInviteInfo = async () => {
    try {
      const response = await apiRequest('/api/projects/invite-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ inviteCode, discussionId })
      });

      const data = await response.json();
      if (data.success) {
        setInviteInfo(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching invite info:', error);
      setLoading(false);
    }
  };

  const isDiscussionInvite = !!discussionId;
  const alreadyInProject = inviteInfo?.isMember;
  const alreadyInDiscussion = inviteInfo?.discussion?.isParticipant;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.inviteModal}>
        <div style={styles.inviteHeader}>
          <div style={styles.inviteIcon}>
            {isDiscussionInvite ? '💬' : '🎉'}
          </div>
          <h2 style={styles.inviteTitle}>
            {isDiscussionInvite ? 'Discussion Invite' : 'Project Invite'}
          </h2>
        </div>

        <div style={styles.inviteBody}>
          {loading ? (
            <div style={styles.inviteLoading}>Loading invite details...</div>
          ) : inviteInfo ? (
            <>
              <p style={styles.inviteText}>
                {isDiscussionInvite 
                  ? `You've been invited to join the discussion "${inviteInfo.discussion?.title || 'Discussion'}" in "${inviteInfo.project.title}".`
                  : `You've been invited to join "${inviteInfo.project.title}".`}
              </p>
              
              {isDiscussionInvite && (
                <div style={styles.inviteNote}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4M12 8h.01"/>
                  </svg>
                  <span>
                    {alreadyInProject 
                      ? (alreadyInDiscussion ? "You're already in this discussion" : "You'll be added to this discussion")
                      : "You'll be added to the project and this discussion"}
                  </span>
                </div>
              )}

              <div style={styles.inviteDetails}>
                <div style={styles.inviteDetailItem}>
                  <span style={styles.inviteDetailLabel}>Project:</span>
                  <div style={styles.inviteDetailValue}>{inviteInfo.project.title}</div>
                </div>
                {isDiscussionInvite && inviteInfo.discussion && (
                  <div style={styles.inviteDetailItem}>
                    <span style={styles.inviteDetailLabel}>Discussion:</span>
                    <div style={styles.inviteDetailValue}>{inviteInfo.discussion.title}</div>
                  </div>
                )}
                <div style={styles.inviteDetailItem}>
                  <span style={styles.inviteDetailLabel}>Members:</span>
                  <div style={styles.inviteDetailValue}>{inviteInfo.project.memberCount} members</div>
                </div>
              </div>
            </>
          ) : (
            <div style={styles.inviteLoading}>Failed to load invite details</div>
          )}
        </div>

        <div style={styles.inviteActions}>
          <button
            onClick={onDecline}
            disabled={isJoining}
            style={styles.inviteDeclineBtn}
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={isJoining || loading || !inviteInfo}
            style={styles.inviteAcceptBtn}
          >
            {isJoining ? 'Joining...' : (alreadyInProject && alreadyInDiscussion ? 'Continue' : 'Accept & Join')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
          <ToastContainer
            position="top-right"
            autoClose={4000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
            style={{ zIndex: 99999 }}
          />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d0d0d',
    color: '#ececec',
    gap: '20px'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #2d2d2d',
    borderTop: '4px solid #8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '16px',
    color: '#6b7280'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(4px)'
  },
  inviteModal: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '480px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    animation: 'slideUp 0.3s ease-out'
  },
  inviteHeader: {
    padding: '24px 24px 16px',
    textAlign: 'center',
    borderBottom: '1px solid #2d2d2d'
  },
  inviteIcon: {
    fontSize: '48px',
    marginBottom: '12px'
  },
  inviteTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#ececec',
    margin: 0
  },
  inviteBody: {
    padding: '24px'
  },
  inviteLoading: {
    textAlign: 'center',
    color: '#b4b4b4',
    padding: '20px'
  },
  inviteText: {
    fontSize: '15px',
    color: '#b4b4b4',
    lineHeight: '1.6',
    margin: '0 0 20px 0',
    textAlign: 'center'
  },
  inviteNote: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#b4b4b4',
    marginBottom: '20px'
  },
  inviteDetails: {
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    padding: '16px'
  },
  inviteDetailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  inviteDetailLabel: {
    fontSize: '12px',
    color: '#8e8ea0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  inviteDetailValue: {
    fontSize: '14px',
    color: '#ececec',
    background: '#1a1a1a',
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #2d2d2d',
    marginTop: '4px'
  },
  inviteActions: {
    display: 'flex',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid #2d2d2d'
  },
  inviteDeclineBtn: {
    flex: 1,
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#b4b4b4',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      background: '#1a1a1a',
      borderColor: '#3d3d3d'
    }
  },
  inviteAcceptBtn: {
    flex: 1,
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    ':hover': {
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
    },
    ':disabled': {
      opacity: 0.5,
      cursor: 'not-allowed'
    }
  }
};
