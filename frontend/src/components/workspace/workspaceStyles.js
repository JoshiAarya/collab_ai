const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
    width: '100%'
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
    transition: 'all 0.2s',
    '&:hover': {
      background: 'rgba(255,255,255,0.05)',
      color: '#ececec'
    }
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderBottom: '1px solid #2d2d2d'
  },
  sidebarHeaderBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '6px',
    color: '#ececec',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  closeSidebarBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },
  discussionsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px'
  },
  discussionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#ececec',
    fontSize: '14px',
    marginBottom: '2px',
    transition: 'background 0.2s'
  },
  discussionName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  sidebarFooter: {
    borderTop: '1px solid #2d2d2d',
    padding: '12px'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px',
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
    overflow: 'hidden'
  },
  userName: {
    fontSize: '14px',
    color: '#ececf1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    marginTop: '8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-left 0.2s',
    position: 'relative',
    background: '#0d0d0d'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #2d2d2d',
    position: 'relative'
  },
  headerTitle: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginLeft: '8px',
    minWidth: 0,
    flexWrap: 'wrap',
    position: 'relative'
  },
  title: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececec',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0
  },
  headerActions: {
    position: 'relative'
  },
  menuBtn: {
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    color: '#ececec',
    cursor: 'pointer'
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '8px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    minWidth: '180px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 1000
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    background: '#0d0d0d'
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#ececec',
    marginBottom: '8px'
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px'
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #2d2d2d',
    borderTop: '3px solid #8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '14px',
    color: '#b4b4b4'
  },
  aiThinkingIndicator: {
    padding: '24px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  thinkingDots: {
    display: 'flex',
    gap: '4px',
    padding: '12px'
  },
  statusBanner: {
    padding: '8px 16px',
    background: '#f59e0b',
    color: '#000',
    textAlign: 'center',
    fontSize: '13px',
    fontWeight: '500'
  },
  aiAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#8b5cf6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600'
  },
  inputArea: {
    padding: '12px 0 16px',
    position: 'relative'
  },
  mentionBox: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '48rem',
    width: 'calc(100% - 48px)',
    background: '#202123',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    marginBottom: '8px',
    maxHeight: '300px',
    overflowY: 'auto',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  mentionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  mentionAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
  },
  mentionInfo: {
    flex: 1
  },
  mentionName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '2px'
  },
  mentionUsername: {
    fontSize: '12px',
    color: '#8e8ea0'
  },
  messageUserAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600'
  },
  inputBox: {
    maxWidth: '48rem',
    margin: '0 auto',
    position: 'relative',
    background: '#1a1a1a',
    borderRadius: '12px',
    border: '1px solid #2d2d2d',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    padding: '12px'
  },
  attachBtn: {
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    color: '#6b6b6b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  attachMenu: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    marginBottom: '8px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    minWidth: '200px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    zIndex: 1000
  },
  attachMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    color: '#ececec',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ececec',
    fontSize: '16px',
    resize: 'none',
    maxHeight: '200px',
    fontFamily: 'inherit',
    lineHeight: '24px'
  },
  sendBtn: {
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    padding: '8px',
    color: '#8b5cf6',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.2s'
  },
  settingsOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px'
  },
  settingsModal: {
    background: '#1a1a1a',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    border: '1px solid #2d2d2d'
  },
  settingsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  settingsTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#ececf1',
    margin: 0
  },
  settingsClose: {
    background: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    cursor: 'pointer',
    padding: '4px'
  },
  settingsBody: {
    padding: '24px'
  },
  settingSection: {
    marginBottom: '32px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '12px'
  },
  sectionDesc: {
    fontSize: '14px',
    color: '#8e8ea0',
    marginBottom: '12px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexWrap: 'wrap',
    gap: '4px'
  },
  infoLabel: {
    fontSize: '14px',
    color: '#8e8ea0'
  },
  infoValue: {
    fontSize: '14px',
    color: '#ececf1',
    fontWeight: '500'
  },
  codeBox: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  code: {
    flex: 1,
    background: '#40414f',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '16px',
    fontFamily: 'monospace',
    color: '#ececf1',
    letterSpacing: '2px'
  },
  copyBtn: {
    background: '#10a37f',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  memberInfo: {
    flex: 1
  },
  memberName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ececf1',
    marginBottom: '2px'
  },
  memberRole: {
    fontSize: '12px',
    color: '#8e8ea0',
    textTransform: 'capitalize'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '16px'
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
    border: '1px solid #2d2d2d'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #2d2d2d'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#ececec',
    margin: 0
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'all 0.2s'
  },
  modalBody: {
    padding: '24px'
  },
  modalInput: {
    width: '100%',
    padding: '12px',
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    marginBottom: '16px'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
  },
  modalCancel: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  modalSubmit: {
    padding: '10px 20px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: '600'
  },
  fullPage: {
    width: '100%',
    height: '100vh',
    background: '#0d0d0d',
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 24px',
    borderBottom: '1px solid #2d2d2d',
    background: '#171717',
    flexWrap: 'wrap'
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '6px',
    color: '#ececec',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px'
  },
  pageTitle: {
    flex: 1,
    fontSize: '24px',
    fontWeight: '600',
    color: '#ececec',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0
  },
  refreshButton: {
    padding: '8px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '6px',
    color: '#ececec',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: '600'
  },
  pageContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px'
  },
  pageLoading: {
    padding: '40px',
    textAlign: 'center',
    color: '#b4b4b4'
  },
  pageError: {
    padding: '40px',
    textAlign: 'center',
    color: '#ef4444'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  statCard: {
    background: '#1a1a1a',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #2d2d2d'
  },
  statLabel: {
    fontSize: '14px',
    color: '#b4b4b4',
    marginBottom: '8px'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#ececec',
    textTransform: 'capitalize'
  },
  insightSection: {
    background: '#1a1a1a',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #2d2d2d',
    marginBottom: '16px'
  },
  insightTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ececec',
    marginBottom: '12px'
  },
  topicsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  topicTag: {
    padding: '6px 12px',
    background: '#0d0d0d',
    borderRadius: '16px',
    fontSize: '14px',
    color: '#ececec',
    border: '1px solid #2d2d2d'
  },
  listItem: {
    padding: '8px 0',
    fontSize: '14px',
    color: '#ececec',
    lineHeight: '1.6'
  },
  suggestionText: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.6'
  },
  emptyText: {
    fontSize: '16px',
    color: '#8e8ea0',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '14px',
    color: '#565869'
  },
  documentsList: {
    display: 'grid',
    gap: '12px'
  },
  documentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#1a1a1a',
    borderRadius: '8px',
    border: '1px solid #2d2d2d'
  },
  documentInfo: {
    flex: 1
  },
  documentName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ececec',
    marginBottom: '4px'
  },
  documentMeta: {
    fontSize: '12px',
    color: '#b4b4b4'
  },
  discussionsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    marginBottom: '8px'
  },
  discussionsLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b6b6b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  addDiscussionBtn: {
    background: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px'
  },
  inviteDiscussionBtn: {
    background: 'transparent',
    border: 'none',
    color: '#8e8ea0',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    transition: 'color 0.2s'
  },
  memberInviteItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  },
  inviteBtn: {
    padding: '8px 16px',
    background: '#10a37f',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: '600'
  },
  inviteDesc: {
    fontSize: '14px',
    color: '#8e8ea0',
    marginBottom: '16px',
    lineHeight: '1.5'
  },
  linkBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#40414f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '20px'
  },
  linkText: {
    flex: 1,
    fontSize: '13px',
    color: '#10a37f',
    fontFamily: 'monospace',
    wordBreak: 'break-all'
  },
  copyLinkBtn: {
    padding: '8px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#ececf1',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
    color: '#8e8ea0'
  },
  dividerText: {
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: '600'
  },
  emailSection: {
    marginTop: '20px'
  },
  emailLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececf1',
    marginBottom: '8px'
  },
  emailInputGroup: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px'
  },
  emailInput: {
    flex: 1,
    padding: '10px 12px',
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  sendEmailBtn: {
    padding: '10px 20px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  },
  emailHint: {
    fontSize: '12px',
    color: '#b4b4b4',
    margin: 0
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #2d2d2d',
    marginBottom: '20px'
  },
  tab: {
    flex: 1,
    padding: '12px',
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s'
  },
  tabContent: {
    marginTop: '20px'
  },
  memberItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#40414f',
    borderRadius: '8px'
  },
  memberAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    flexShrink: 0
  },
  addBtn: {
    padding: '8px 16px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: '600'
  },
  modelSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#40414f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#ececf1',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  modelDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '8px',
    background: '#2f2f2f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    minWidth: '320px',
    maxHeight: '500px',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  modelSearch: {
    width: '100%',
    padding: '12px 16px',
    background: '#40414f',
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px 12px 0 0',
    color: '#ececf1',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  modelProviderSection: {
    padding: '4px 0'
  },
  modelProvider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  modelProviderIcon: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  modelProviderName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececf1'
  },
  comingSoon: {
    fontSize: '12px',
    color: '#8e8ea0',
    marginLeft: 'auto'
  },
  summariesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  summaryCard: {
    background: '#40414f',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '20px',
    transition: 'border-color 0.2s'
  },
  summaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    flexWrap: 'wrap',
    gap: '8px'
  },
  summaryMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  summaryDate: {
    fontSize: '13px',
    color: '#8e8ea0',
    fontWeight: '500'
  },
  summaryProvider: {
    fontSize: '12px',
    color: '#565869',
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px'
  },
  summaryActions: {
    display: 'flex',
    gap: '8px'
  },
  summaryActionBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    padding: '6px',
    color: '#ececf1',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s'
  },
  summaryContent: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap'
  },
  refineBox: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  refineInput: {
    width: '100%',
    padding: '12px',
    background: '#343541',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#ececf1',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    marginBottom: '12px'
  },
  refineActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  refineCancelBtn: {
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  refineSubmitBtn: {
    padding: '8px 16px',
    background: '#10a37f',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  // Dashboard Styles
  dashboardPage: {
    minHeight: '100vh',
    background: '#1a1b26',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  dashboardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 32px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    background: '#16171f',
    flexWrap: 'wrap',
    gap: '12px'
  },
  dashboardHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  dashboardBackBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#ececf1',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s'
  },
  dashboardTitle: {
    fontSize: '28px',
    fontWeight: '700',
    margin: 0,
    color: '#fff'
  },
  dashboardSubtitle: {
    fontSize: '14px',
    color: '#8e8ea0',
    margin: '4px 0 0 0'
  },
  dashboardRefreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s'
  },
  dashboardLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '16px'
  },
  dashboardContent: {
    padding: '32px',
    maxWidth: '1600px',
    margin: '0 auto'
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },
  statCardNew: {
    padding: '24px',
    borderRadius: '12px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    color: '#ececec',
    position: 'relative',
    overflow: 'hidden'
  },
  statIconBox: {
    width: '48px',
    height: '48px',
    background: '#8b5cf6',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    color: '#fff'
  },
  statContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  statLabelNew: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#b4b4b4'
  },
  statValueNew: {
    fontSize: '36px',
    fontWeight: '700',
    lineHeight: 1,
    color: '#ececec'
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: '65fr 35fr',
    gap: '24px',
    alignItems: 'start'
  },
  dashboardLeftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  dashboardRightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  dashboardCard: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '12px',
    padding: '24px'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #2d2d2d'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    margin: 0,
    color: '#ececec'
  },
  cardMenuBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    transition: 'background 0.2s'
  },
  updateBadge: {
    fontSize: '12px',
    color: '#b4b4b4',
    padding: '4px 12px',
    background: '#0d0d0d',
    borderRadius: '12px',
    border: '1px solid #2d2d2d'
  },
  cardSection: {
    marginBottom: '24px'
  },
  sectionLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b6b6b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px'
  },
  topicsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  topicBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '20px',
    fontSize: '13px',
    color: '#ececec',
    fontWeight: '500'
  },
  decisionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  decisionItem: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: '#0d0d0d',
    borderRadius: '8px',
    border: '1px solid #2d2d2d'
  },
  decisionNumber: {
    width: '28px',
    height: '28px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '700',
    flexShrink: 0
  },
  decisionText: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.5',
    flex: 1
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  questionItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  questionIcon: {
    width: '32px',
    height: '32px',
    background: 'rgba(239, 68, 68, 0.15)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f87171',
    flexShrink: 0
  },
  questionText: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.5',
    flex: 1
  },
  questionBadge: {
    fontSize: '11px',
    color: '#8e8ea0',
    padding: '2px 8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    whiteSpace: 'nowrap'
  },
  nextStepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  nextStepItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px',
    background: 'rgba(16, 185, 129, 0.05)',
    borderRadius: '8px',
    border: '1px solid rgba(16, 185, 129, 0.2)'
  },
  nextStepIcon: {
    width: '24px',
    height: '24px',
    background: 'rgba(16, 185, 129, 0.2)',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#10b981',
    flexShrink: 0
  },
  nextStepText: {
    fontSize: '14px',
    color: '#ececf1',
    lineHeight: '1.5'
  },
  updateTime: {
    fontSize: '12px',
    color: '#565869',
    marginTop: '16px',
    textAlign: 'right'
  },
  emptyMessage: {
    fontSize: '14px',
    color: '#565869',
    padding: '20px',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  stageSelector: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '8px'
  },
  stageOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    textTransform: 'capitalize',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  activityChart: {
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  chartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  chartLabel: {
    fontSize: '13px',
    color: '#8e8ea0',
    fontWeight: '500'
  },
  chartBars: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '120px',
    gap: '8px'
  },
  chartBarWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  chartBar: {
    width: '100%',
    height: '100px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '6px 6px 0 0',
    position: 'relative',
    overflow: 'hidden'
  },
  chartBarFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: '6px 6px 0 0',
    transition: 'height 0.3s ease'
  },
  chartBarLabel: {
    fontSize: '11px',
    color: '#565869',
    fontWeight: '500'
  },
  participantsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  participantItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  participantAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
    flexShrink: 0
  },
  participantInfo: {
    flex: 1
  },
  participantName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececf1',
    marginBottom: '2px'
  },
  participantTime: {
    fontSize: '12px',
    color: '#565869'
  },
  progressBars: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  progressItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    color: '#ececf1',
    fontWeight: '500'
  },
  progressPercent: {
    color: '#8e8ea0'
  },
  progressBar: {
    height: '8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
  },
  dashboardError: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '16px',
    color: '#8e8ea0'
  },
  retryBtn: {
    padding: '10px 24px',
    background: '#667eea',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  viewAllBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid #3d3d3d',
    borderRadius: '6px',
    color: '#8e8ea0',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  // New Dashboard Redesign Styles
  healthBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '1px',
    background: '#2d2d2d',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '32px',
    border: '1px solid #2d2d2d'
  },
  healthCell: {
    padding: '16px 20px',
    background: '#1a1a1a',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    transition: 'background 0.2s'
  },
  healthLabel: {
    fontSize: '11px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: '600'
  },
  healthValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ececec'
  },
  cardTitleNew: {
    fontSize: '15px',
    fontWeight: '600',
    margin: '0 0 20px 0',
    color: '#ececec',
    letterSpacing: '-0.01em'
  },
  topicBars: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  topicBarRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(80px, 140px) 1fr 40px',
    alignItems: 'center',
    gap: '12px'
  },
  topicName: {
    fontSize: '13px',
    color: '#ececec',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  topicBarContainer: {
    height: '8px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  topicBarFill: {
    height: '100%',
    background: '#667eea',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
  },
  topicCount: {
    fontSize: '13px',
    color: '#8e8ea0',
    fontWeight: '600',
    textAlign: 'right'
  },
  topicMore: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
    fontStyle: 'italic'
  },
  timelineList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  timelineItem: {
    display: 'flex',
    gap: '12px',
    position: 'relative'
  },
  timelineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#667eea',
    marginTop: '6px',
    flexShrink: 0
  },
  timelineContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  timelineText: {
    fontSize: '14px',
    color: '#ececec',
    lineHeight: '1.5'
  },
  timelineMeta: {
    fontSize: '12px',
    color: '#6b7280'
  },
  blockersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  blockerItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  severityDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginTop: '6px',
    flexShrink: 0
  },
  blockerText: {
    fontSize: '14px',
    color: '#ececec',
    lineHeight: '1.5',
    flex: 1
  },
  actionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  actionCheckbox: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    border: '2px solid #4b5563',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#10b981'
  },
  actionText: {
    fontSize: '14px',
    color: '#ececec',
    lineHeight: '1.4',
    flex: 1
  },
  statusBadge: {
    fontSize: '11px',
    padding: '3px 8px',
    borderRadius: '4px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  emptyState: {
    fontSize: '13px',
    color: '#6b7280',
    padding: '24px',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  stageDisplay: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  stageBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
    alignSelf: 'flex-start'
  },
  stageUpdated: {
    fontSize: '12px',
    color: '#6b7280'
  },
  activityChartCompact: {
    padding: '12px 0'
  },
  chartBarsCompact: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '80px',
    gap: '6px'
  },
  chartBarWrapperCompact: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px'
  },
  chartBarCompact: {
    width: '100%',
    height: '60px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '4px 4px 0 0',
    position: 'relative',
    overflow: 'hidden'
  },
  chartBarFillCompact: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease'
  },
  chartBarLabelCompact: {
    fontSize: '10px',
    color: '#6b7280',
    fontWeight: '600'
  },
  participantsListCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  participantItemCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  participantAvatarCompact: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
    flexShrink: 0
  },
  participantInfoCompact: {
    flex: 1,
    minWidth: 0
  },
  participantNameCompact: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#ececec',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  participantTimeCompact: {
    fontSize: '11px',
    color: '#6b7280'
  },
  statsSummary: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)'
  },
  summaryLabel: {
    fontSize: '13px',
    color: '#8e8ea0',
    fontWeight: '500'
  },
  summaryValue: {
    fontSize: '14px',
    color: '#ececec',
    fontWeight: '600'
  }
};

export default styles;
