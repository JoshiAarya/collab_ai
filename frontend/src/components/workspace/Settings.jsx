import React, { useState } from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/api.js';
import { getAvatarColor, getInitials } from '../../utils/avatarColors';
import styles from './workspaceStyles';

export default function Settings({ project, onClose, token, isOwner, colors, onProjectGone }) {
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [memberList, setMemberList] = useState(project.members || []);
  const [busy, setBusy] = useState(false);

  const removeMember = async (member) => {
    const username = member.userId?.username || 'this member';
    if (!window.confirm(`Remove ${username} from the project?`)) return;
    setBusy(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/members/${member.userId?._id || member.userId}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setMemberList(prev => prev.filter(m =>
          (m.userId?._id || m.userId) !== (member.userId?._id || member.userId)
        ));
      } else {
        toast.error(data.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const leaveProject = async () => {
    if (!window.confirm(`Leave "${project.title}"? You'll need a new invite to rejoin.`)) return;
    setBusy(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/leave`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        onProjectGone();
      } else {
        toast.error(data.error || 'Failed to leave project');
        setBusy(false);
      }
    } catch (error) {
      console.error('Error leaving project:', error);
      toast.error('Failed to leave project. Please try again.');
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    if (!window.confirm(`Delete "${project.title}"? All discussions, messages, documents, and knowledge will be permanently removed. This cannot be undone.`)) return;
    setBusy(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        onProjectGone();
      } else {
        toast.error(data.error || 'Failed to delete project');
        setBusy(false);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project. Please try again.');
      setBusy(false);
    }
  };

  const copyInviteCode = () => {
    const inviteLink = `${window.location.origin}/join/${project.inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInviteEmail = async () => {
    if (!emailInput.trim()) {
      toast.warning('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/invite-email`,
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

  const members = memberList;

  return (
    <div style={styles.settingsOverlay}>
      <div className="settings-modal-responsive" style={{...styles.settingsModal, background: colors.surface, border: `1px solid ${colors.border}`}}>
        <div style={{...styles.settingsHeader, borderBottom: `1px solid ${colors.border}`}}>
          <h2 style={{...styles.settingsTitle, color: colors.text}}>Project Settings</h2>
          <button onClick={onClose} style={{...styles.settingsClose, color: colors.textSecondary}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div style={styles.settingsBody}>
          <div style={styles.settingSection}>
            <h3 style={{...styles.sectionTitle, color: colors.text}}>Project Information</h3>
            <div style={styles.infoRow}>
              <span style={{...styles.infoLabel, color: colors.textSecondary}}>Title:</span>
              <span style={{...styles.infoValue, color: colors.text}}>{project.title}</span>
            </div>
          </div>

          <div style={styles.settingSection}>
            <h3 style={{...styles.sectionTitle, color: colors.text}}>Invite Link</h3>
            <p style={{...styles.sectionDesc, color: colors.textSecondary}}>Share this link with team members</p>
            <div style={styles.codeBox}>
              <code style={{...styles.code, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text, wordBreak: 'break-all', fontSize: '13px'}}>{`${window.location.origin}/join/${project.inviteCode}`}</code>
              <button onClick={copyInviteCode} style={styles.copyBtn}>
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
              </button>
            </div>
            
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${colors.border}` }}>
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
                    flex: 1,
                    padding: '10px 12px',
                    background: colors.background,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.text,
                    fontSize: '14px',
                    outline: 'none',
                    fontFamily: 'inherit'
                  }}
                />
                <button
                  onClick={handleSendInviteEmail}
                  disabled={sendingEmail || !emailInput.trim()}
                  style={{
                    padding: '10px 20px',
                    background: '#8b5cf6',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: sendingEmail || !emailInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: sendingEmail || !emailInput.trim() ? 0.5 : 1,
                    fontFamily: 'inherit'
                  }}
                >
                  {sendingEmail ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>

          <div style={styles.settingSection}>
            <h3 style={{...styles.sectionTitle, color: colors.text}}>Members ({members.length})</h3>
            <div style={styles.membersList}>
              {members.map((member, i) => {
                const username = member.userId?.username || 'Unknown';
                const role = member.role || 'member';
                const avatarColor = getAvatarColor(username);
                const initials = getInitials(username);
                return (
                  <div key={i} style={{...styles.memberItem, background: colors.surface, border: `1px solid ${colors.border}`}}>
                    <div style={{
                      ...styles.memberAvatar,
                      background: avatarColor
                    }}>
                      {initials}
                    </div>
                    <div style={styles.memberInfo}>
                      <div style={{...styles.memberName, color: colors.text}}>{username}</div>
                      <div style={{...styles.memberRole, color: colors.textSecondary}}>{role === 'owner' ? 'Owner' : 'Member'}</div>
                    </div>
                    {isOwner && role !== 'owner' && (
                      <button
                        onClick={() => removeMember(member)}
                        disabled={busy}
                        title="Remove member"
                        style={{
                          marginLeft: 'auto', background: 'transparent',
                          border: `1px solid ${colors.border}`, borderRadius: '6px',
                          padding: '4px 8px', color: '#ef4444', fontSize: '12px',
                          cursor: busy ? 'wait' : 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={styles.settingSection}>
            <h3 style={{...styles.sectionTitle, color: '#ef4444'}}>Danger Zone</h3>
            {isOwner ? (
              <>
                <p style={{...styles.sectionDesc, color: colors.textSecondary}}>
                  Permanently delete this project, including all discussions, messages, documents, and extracted knowledge.
                </p>
                <button
                  onClick={deleteProject}
                  disabled={busy}
                  style={{
                    padding: '10px 20px', background: 'transparent',
                    border: '1px solid #ef4444', borderRadius: '6px',
                    color: '#ef4444', fontSize: '14px', fontWeight: '600',
                    cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit'
                  }}
                >
                  Delete Project
                </button>
              </>
            ) : (
              <>
                <p style={{...styles.sectionDesc, color: colors.textSecondary}}>
                  Leave this project. You'll need a new invite to rejoin.
                </p>
                <button
                  onClick={leaveProject}
                  disabled={busy}
                  style={{
                    padding: '10px 20px', background: 'transparent',
                    border: '1px solid #ef4444', borderRadius: '6px',
                    color: '#ef4444', fontSize: '14px', fontWeight: '600',
                    cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit'
                  }}
                >
                  Leave Project
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
