import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/api.js';
import { getAvatarColor, getInitials } from '../../utils/avatarColors';
import styles from './workspaceStyles';

export default function InviteToDiscussionModal({ project, discussionId, token, onClose, onInvite, colors }) {
  const [discussion, setDiscussion] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState('members'); // 'members' or 'external'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load discussion
      const discResponse = await apiRequest(
        `/api/projects/${project._id}/discussions`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const discData = await discResponse.json();
      if (discData.success) {
        const disc = discData.discussions.find(d => d._id === discussionId);
        setDiscussion(disc);
      }

      // Load project members
      const projectResponse = await apiRequest(
        `/api/projects/${project._id}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const projectData = await projectResponse.json();
      if (projectData.success && projectData.project) {
        setMembers(projectData.project.members || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (userId) => {
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussionId}/invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ userId })
        }
      );
      const data = await response.json();
      if (data.success) {
        onInvite();
        loadData(); // Refresh
      }
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const inviteLink = `${window.location.origin}/join/${project.inviteCode}?discussion=${discussionId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!emailInput.trim()) {
      toast.warning('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussionId}/invite-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            email: emailInput.trim(),
            discussionTitle: discussion?.title || 'Discussion'
          })
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

  const participantIds = discussion?.participants?.map(p => p._id || p) || [];
  const availableMembers = members
    .map(m => m.userId || m)
    .filter(m => m && m._id && !participantIds.includes(m._id));

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{...styles.modal, background: colors.surface, border: `1px solid ${colors.border}`}} onClick={(e) => e.stopPropagation()}>
        <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
          <h3 style={{...styles.modalTitle, color: colors.text}}>Invite to {discussion?.title || 'Discussion'}</h3>
          <button onClick={onClose} style={{...styles.modalClose, color: colors.textTertiary}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: colors.textSecondary }}>Loading...</div>
        ) : (
          <div style={styles.modalBody}>
            {/* Tabs */}
            <div style={{...styles.tabs, borderBottom: `1px solid ${colors.border}`}}>
              <button
                onClick={() => setActiveTab('members')}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === 'members' ? '2px solid #8b5cf6' : '2px solid transparent',
                  color: activeTab === 'members' ? colors.text : colors.textTertiary
                }}
              >
                Project Members
              </button>
              <button
                onClick={() => setActiveTab('external')}
                style={{
                  ...styles.tab,
                  borderBottom: activeTab === 'external' ? '2px solid #8b5cf6' : '2px solid transparent',
                  color: activeTab === 'external' ? colors.text : colors.textTertiary
                }}
              >
                External Invite
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'members' ? (
              <div style={styles.tabContent}>
                {availableMembers.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: colors.textSecondary }}>
                    All project members are already in this discussion
                  </div>
                ) : (
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {availableMembers.map(member => {
                      const avatarColor = getAvatarColor(member.username || 'User');
                      const initials = getInitials(member.username || 'User');
                      return (
                        <div key={member._id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: colors.background,
                          borderRadius: '8px',
                          marginBottom: '8px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: avatarColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: '600',
                              flexShrink: 0
                            }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ color: colors.text, fontSize: '14px', fontWeight: '500' }}>
                                {member.username || 'Unknown'}
                              </div>
                              <div style={{ color: colors.textSecondary, fontSize: '12px', marginTop: '2px' }}>
                                {member.email || ''}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddMember(member._id)}
                            style={{
                              padding: '8px 16px',
                              background: '#8b5cf6',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#fff',
                              fontSize: '14px',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#7c3aed'}
                            onMouseLeave={(e) => e.target.style.background = '#8b5cf6'}
                          >
                            Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.tabContent}>
                <p style={{...styles.inviteDesc, color: colors.textSecondary}}>
                  Share this link with people outside the project:
                </p>

                <div style={{...styles.linkBox, background: colors.background, border: `1px solid ${colors.border}`}}>
                  <code style={styles.linkText}>{inviteLink}</code>
                  <button onClick={handleCopyLink} style={{...styles.copyLinkBtn, border: `1px solid ${colors.border}`, color: colors.text}} title="Copy link">
                    {copied ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
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

                <div style={{...styles.divider, color: colors.textSecondary}}>
                  <span style={styles.dividerText}>OR</span>
                </div>

                <div style={styles.emailSection}>
                  <label style={{...styles.emailLabel, color: colors.text}}>Send via email</label>
                  <div style={styles.emailInputGroup}>
                    <input
                      type="email"
                      placeholder="colleague@company.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      style={{...styles.emailInput, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text}}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendEmail()}
                    />
                    <button 
                      onClick={handleSendEmail} 
                      style={styles.sendEmailBtn}
                      disabled={sendingEmail || !emailInput.trim()}
                    >
                      {sendingEmail ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                  <p style={{...styles.emailHint, color: colors.textSecondary}}>
                    They'll receive an email with the invite link
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
