import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import { toast } from 'react-toastify';
import apiRequest from '../utils/api.js';

export default function ProfileModal({ onClose }) {
  const { user, token, refreshAuth } = useAuth();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  
  // Profile form
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.bio || '');
  
  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await apiRequest('/api/user/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiRequest('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, email, bio })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Profile updated successfully!');
        await refreshAuth();
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.error || 'Failed to change password');
      }
    } catch {
      toast.error('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(colors);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Profile Settings</h2>
          <button onClick={onClose} style={styles.closeBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div style={styles.content}>
          {/* Avatar Section */}
          <div style={styles.avatarSection}>
            <div style={{
              ...styles.avatar,
              background: getAvatarColor(user?.username)
            }}>
              {getInitials(user?.username)}
            </div>
            <div style={styles.avatarInfo}>
              <h3 style={styles.avatarName}>{user?.username}</h3>
              <p style={styles.avatarEmail}>{user?.email || 'No email set'}</p>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="profile-stats-grid" style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{stats.projectCount}</div>
                <div style={styles.statLabel}>Projects</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{stats.messageCount}</div>
                <div style={styles.statLabel}>Messages</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>
                  {new Date(stats.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
                <div style={styles.statLabel}>Joined</div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={styles.tabs}>
            <button
              onClick={() => setActiveTab('profile')}
              style={{
                ...styles.tab,
                ...(activeTab === 'profile' ? styles.tabActive : {})
              }}
            >
              Profile
            </button>
            {user?.authProvider === 'local' && (
              <button
                onClick={() => setActiveTab('password')}
                style={{
                  ...styles.tab,
                  ...(activeTab === 'password' ? styles.tabActive : {})
                }}
              >
                Password
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div style={styles.tabContent}>
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={styles.input}
                    required
                    maxLength={20}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    style={{...styles.input, minHeight: '80px', resize: 'vertical'}}
                    maxLength={200}
                    placeholder="Tell us about yourself..."
                  />
                  <div style={styles.charCount}>{bio.length}/200</div>
                </div>

                <button type="submit" style={styles.submitBtn} disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}

            {activeTab === 'password' && (
              <form onSubmit={handleChangePassword}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={styles.input}
                    required
                    minLength={6}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>

                <button type="submit" style={styles.submitBtn} disabled={loading}>
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const getStyles = (colors) => ({
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px'
  },
  modal: {
    background: colors.surface,
    borderRadius: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: `1px solid ${colors.border}`
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px',
    borderBottom: `1px solid ${colors.border}`
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: colors.text,
    margin: 0
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: colors.textTertiary,
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  content: {
    padding: '24px'
  },
  avatarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    padding: '20px',
    background: colors.background,
    borderRadius: '12px',
    border: `1px solid ${colors.border}`
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    fontWeight: '600',
    color: '#fff',
    flexShrink: 0
  },
  avatarInfo: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden'
  },
  avatarName: {
    fontSize: '18px',
    fontWeight: '600',
    color: colors.text,
    margin: '0 0 4px 0'
  },
  avatarEmail: {
    fontSize: '14px',
    color: colors.textSecondary,
    margin: 0
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '24px'
  },
  statCard: {
    padding: '16px',
    background: colors.background,
    borderRadius: '10px',
    border: `1px solid ${colors.border}`,
    textAlign: 'center'
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '600',
    color: colors.text,
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '12px',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: '0'
  },
  tab: {
    padding: '12px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: colors.textSecondary,
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  tabActive: {
    color: colors.primary,
    borderBottomColor: colors.primary
  },
  tabContent: {
    minHeight: '200px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: colors.text,
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px',
    background: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    color: colors.text,
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  charCount: {
    fontSize: '12px',
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: '4px'
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    background: colors.primary,
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s'
  }
});
