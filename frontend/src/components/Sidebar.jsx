import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getAvatarColor, getInitials } from '../utils/avatarColors';
import ProfileModal from './ProfileModal';

export default function Sidebar({ children, footerContent, iconBarContent, onToggle, isOpen = true }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, colors } = useTheme();
  const [isHovered, setIsHovered] = React.useState(false);
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);
  const [showProfileModal, setShowProfileModal] = React.useState(false);

  const styles = getStyles(colors);

  return (
    <>
      {/* Icon Bar - Always visible */}
      <div style={styles.iconBar}>
        <button 
          onClick={onToggle} 
          style={styles.iconBarBtn}
          title={isOpen ? "Close sidebar" : "Open sidebar"}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isHovered ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 3v18"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          )}
        </button>

        {!isOpen && iconBarContent}
      </div>

      {/* Sidebar */}
      {isOpen && (
        <div style={styles.sidebar}>
          <div style={styles.sidebarContent}>
            {children}
          </div>

          <div style={styles.sidebarFooter}>
            {footerContent}
            
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                style={styles.userSection}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1a1a1a'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  ...styles.userAvatar,
                  background: getAvatarColor(user?.username)
                }}>
                  {getInitials(user?.username)}
                </div>
                <div style={styles.userInfo}>
                  <div style={styles.userName}>{user?.username}</div>
                  <div style={styles.userEmail}>{user?.email}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M18 15l-6-6-6 6"/>
                </svg>
              </button>

              {showUserDropdown && (
                <>
                  <div 
                    style={styles.dropdownBackdrop} 
                    onClick={() => setShowUserDropdown(false)}
                  />
                  <div style={getStyles(colors).userDropdown}>
                    <button 
                      style={getStyles(colors).dropdownItem}
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowProfileModal(true);
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <span>Profile</span>
                    </button>
                    
                    <button 
                      style={getStyles(colors).dropdownItem}
                      onClick={() => {
                        setShowUserDropdown(false);
                        toggleTheme();
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {theme === 'dark' ? (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="5"/>
                            <line x1="12" y1="1" x2="12" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="23"/>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                            <line x1="1" y1="12" x2="3" y2="12"/>
                            <line x1="21" y1="12" x2="23" y2="12"/>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                          </svg>
                          <span>Switch to Light Mode</span>
                        </>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                          </svg>
                          <span>Switch to Dark Mode</span>
                        </>
                      )}
                    </button>

                    <div style={getStyles(colors).dropdownDivider} />
                    
                    <button 
                      style={getStyles(colors).dropdownItem}
                      onClick={() => {
                        setShowUserDropdown(false);
                        logout();
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = colors.surfaceHover}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      <span>Log out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {showProfileModal && (
        <ProfileModal onClose={() => setShowProfileModal(false)} />
      )}
    </>
  );
}

const getStyles = (colors) => ({
  iconBar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: '48px',
    background: colors.iconBar,
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    gap: '8px',
    zIndex: 1000
  },
  iconBarBtn: {
    width: '40px',
    height: '40px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: colors.textTertiary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  sidebar: {
    position: 'fixed',
    left: '48px',
    top: 0,
    bottom: 0,
    width: '280px',
    background: colors.surface,
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 999
  },
  sidebarContent: {
    flex: 1,
    overflowY: 'auto'
  },
  sidebarFooter: {
    padding: '16px',
    borderTop: `1px solid ${colors.border}`
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    background: 'transparent',
    border: 'none',
    width: '100%',
    fontFamily: 'inherit'
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    flexShrink: 0
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
    textAlign: 'left'
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: colors.text,
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  userEmail: {
    fontSize: '12px',
    color: colors.textTertiary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  dropdownBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1999
  },
  userDropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: '8px',
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '10px',
    padding: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    zIndex: 2000,
    animation: 'slideUp 0.2s ease-out'
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: colors.text,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    fontFamily: 'inherit',
    textAlign: 'left'
  },
  dropdownDivider: {
    height: '1px',
    background: colors.border,
    margin: '6px 0'
  }
});
