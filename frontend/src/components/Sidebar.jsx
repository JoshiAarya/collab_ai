import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarColor, getInitials } from '../utils/avatarColors';

export default function Sidebar({ children, footerContent, iconBarContent, onToggle, isOpen = true }) {
  const { user, logout } = useAuth();
  const [isHovered, setIsHovered] = React.useState(false);

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
            
            <div style={styles.userSection}>
              <div style={{
                ...styles.userAvatar,
                background: getAvatarColor(user?.username)
              }}>
                {getInitials(user?.username)}
              </div>
              <div style={styles.userInfo}>
                <div style={styles.userName}>{user?.username}</div>
                <button onClick={logout} style={styles.logoutBtn}>
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  iconBar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: '48px',
    background: '#000000',
    borderRight: '1px solid #2d2d2d',
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
    color: '#6b6b6b',
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
    background: '#171717',
    borderRight: '1px solid #2d2d2d',
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
    borderTop: '1px solid #2d2d2d'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
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
    minWidth: 0
  },
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececec',
    marginBottom: '2px',
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
  }
};
