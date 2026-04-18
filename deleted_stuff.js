import ProjectIntelligenceCard from './ProjectIntelligenceCard';
import DecisionTimeline from './DecisionTimeline';
import BlockerTracker from './BlockerTracker';
              {messages.map((m, i) => <MessageBubble key={i} message={m} currentUser={user?.username} colors={colors} />)}
function MessageBubble({ message, currentUser, colors }) {
            marginBottom: '8px'
            {message.user}
function _DashboardLegacy({ project, onClose, token, colors }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedModal, setExpandedModal] = useState(null); // 'topics', 'decisions', 'blockers', 'actions'

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/dashboard`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        setDashboard(data.dashboard);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboard = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/dashboard/refresh`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        setDashboard(data.dashboard);
      }
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage) => {
    const colors = {
      'ideation': '#8b5cf6',
      'design': '#3b82f6',
      'discussion': '#10b981',
      'blocked': '#ef4444',
      'completed': '#06b6d4'
    };
    return colors[stage] || '#6b7280';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      'high': '#ef4444',
      'medium': '#f59e0b',
      'low': '#6b7280'
    };
    return colors[severity] || '#6b7280';
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate momentum (messages per discussion)
  const momentum = dashboard ? Math.round(dashboard.totalMessages / Math.max(dashboard.activeDiscussions, 1)) : 0;

  // Filter valid blockers (remove garbage entries)
  const getValidBlockers = (blockers) => {
    if (!blockers || !Array.isArray(blockers)) return [];
    return blockers.filter(b => {
      const text = b.text || b;
      if (!text || typeof text !== 'string') return false;
      const normalized = text.toLowerCase().trim();
      return !(
        normalized === 'none' || 
        normalized === 'none mentioned' || 
        normalized === 'no blockers' ||
        normalized === 'n/a' ||
        normalized.startsWith('no ') ||
        normalized.length < 5
      );
    });
  };

  const validBlockers = dashboard ? getValidBlockers(dashboard.openQuestions) : [];

  // Calculate topic distribution ÔÇö handle both string[] (legacy) and {name,count}[] (entity model)
  const topicData = (dashboard?.topics || []).map(t =>
    typeof t === 'string' ? { name: t, count: 1 } : t
  );
  const sortedTopics = [...topicData].sort((a, b) => (b.count || 0) - (a.count || 0));
  const topTopics = sortedTopics.slice(0, 5);
  const remainingTopics = sortedTopics.length - 5;
  const maxCount = Math.max(...topTopics.map(t => t.count || 1), 1);

  return (
    <div style={{...styles.dashboardPage, background: colors.background}}>
      {/* Header */}
      <div style={{...styles.dashboardHeader, background: colors.surface, borderBottom: `1px solid ${colors.border}`}}>
        <div style={styles.dashboardHeaderLeft}>
          <button onClick={onClose} style={{...styles.dashboardBackBtn, border: `1px solid ${colors.border}`, color: colors.text}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <div>
            <h1 style={{...styles.dashboardTitle, color: colors.text}}>Dashboard</h1>
            <p style={{...styles.dashboardSubtitle, color: colors.textSecondary}}>{project.title}</p>
            {dashboard?.projectSummary && (
              <p style={{...styles.dashboardSubtitle, color: colors.textSecondary, marginTop: '8px', fontStyle: 'italic'}}>
                {dashboard.projectSummary}
              </p>
            )}
          </div>
        </div>
        <button onClick={refreshDashboard} style={{...styles.dashboardRefreshBtn, background: colors.surface, border: `1px solid ${colors.border}`, color: colors.text}} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading && !dashboard ? (
        <div style={styles.dashboardLoading}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Loading insights...</p>
        </div>
      ) : dashboard ? (
        <div style={styles.dashboardContent}>
          {/* Project Health Bar */}
          <div style={{...styles.healthBar, background: colors.border, border: `1px solid ${colors.border}`}}>
            <div style={{...styles.healthCell, background: colors.surface}}>
              <div style={{...styles.healthLabel, color: colors.textSecondary}}>Stage</div>
              <div style={{...styles.healthValue, color: getStageColor(dashboard.stage || 'ideation')}}>
                {(dashboard.stage || 'ideation').charAt(0).toUpperCase() + (dashboard.stage || 'ideation').slice(1)}
              </div>
            </div>
            <div style={{...styles.healthCell, background: colors.surface}}>
              <div style={{...styles.healthLabel, color: colors.textSecondary}}>Momentum</div>
              <div style={{...styles.healthValue, color: colors.text}}>{momentum} msg/disc</div>
            </div>
            <div style={{
              ...styles.healthCell,
              background: validBlockers.length > 0 ? 'rgba(239, 68, 68, 0.05)' : colors.surface
            }}>
              <div style={{...styles.healthLabel, color: colors.textSecondary}}>Open Blockers</div>
              <div style={{
                ...styles.healthValue,
                color: validBlockers.length > 0 ? '#ef4444' : '#10b981'
              }}>
                {validBlockers.length}
              </div>
            </div>
            <div style={{...styles.healthCell, background: colors.surface}}>
              <div style={{...styles.healthLabel, color: colors.textSecondary}}>Action Items</div>
              <div style={{...styles.healthValue, color: colors.text}}>{dashboard.actionItems?.length || 0}</div>
            </div>
            <div style={{...styles.healthCell, background: colors.surface}}>
              <div style={{...styles.healthLabel, color: colors.textSecondary}}>Active Discussions</div>
              <div style={{...styles.healthValue, color: colors.text}}>{dashboard.activeDiscussions}</div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div style={styles.dashboardGrid}>
            {/* Left Column - Intelligence */}
            <div style={styles.dashboardLeftCol}>

              {/* Strategic Signals */}
              {dashboard.signals?.length > 0 && (
                <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dashboard.signals.map((signal, i) => {
                    const color = signal.severity === 'high' ? '#ef4444' : signal.severity === 'medium' ? '#f59e0b' : '#6b7280';
                    const bg = signal.severity === 'high' ? 'rgba(239,68,68,0.08)' : signal.severity === 'medium' ? 'rgba(245,158,11,0.08)' : 'rgba(107,114,128,0.08)';
                    const icon = signal.type === 'decision_drift' ? 'ÔÜí' : signal.type === 'blocker_stagnation' ? '­ƒö┤' : '­ƒôë';
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                        padding: '12px 16px', borderRadius: '8px',
                        background: bg, border: `1px solid ${color}30`
                      }}>
                        <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
                        <span style={{ fontSize: '13px', color: colors.text, lineHeight: '1.5' }}>{signal.message}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Project Intelligence Card ÔÇö entity model data */}
              {dashboard.projectState && (
                <ProjectIntelligenceCard
                  projectState={dashboard.projectState}
                  colors={colors}
                />
              )}

              {/* Decision Timeline ÔÇö entity model data */}
              {dashboard.enrichedDecisions?.length > 0 && (
                <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`, marginBottom: '16px'}}>
                  <h3 style={{...styles.cardTitleNew, color: colors.text, marginBottom: '16px'}}>Decision Timeline</h3>
                  <DecisionTimeline enrichedDecisions={dashboard.enrichedDecisions} colors={colors} />
                </div>
              )}

              {/* Revised Decisions ÔÇö superseded by newer choices */}
              {dashboard.enrichedSuperseded?.length > 0 && (
                <div style={{
                  ...styles.dashboardCard,
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderLeft: '3px solid #6b7280',
                  marginBottom: '16px',
                  opacity: 0.85
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: colors.textSecondary, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Ôå®</span> Revised Decisions
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {dashboard.enrichedSuperseded.map((d, i) => (
                      <div key={i} style={{ padding: '10px 12px', background: colors.background, borderRadius: '6px', border: `1px solid ${colors.border}` }}>
                        <div style={{ fontSize: '13px', color: colors.textSecondary, textDecoration: 'line-through', marginBottom: d.supersededByText ? '6px' : 0 }}>
                          {d.text}
                        </div>
                        {d.supersededByText && (
                          <div style={{ fontSize: '13px', color: colors.text, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <span style={{ color: '#10b981', flexShrink: 0 }}>ÔåÆ</span>
                            {d.supersededByText}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topic Distribution */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{...styles.cardTitleNew, color: colors.text}}>Topic Distribution</h3>
                  {topTopics.length > 5 && (
                    <button 
                      onClick={() => setExpandedModal('topics')}
                      style={{...styles.viewAllBtn, border: `1px solid ${colors.border}`, color: colors.textSecondary}}
                    >
                      View All ({topTopics.length})
                    </button>
                  )}
                </div>
                {topTopics.length > 0 ? (
                  <div style={styles.topicBars}>
                    {topTopics.slice(0, 5).map((topic, i) => (
                      <div key={i} style={styles.topicBarRow}>
                        <div style={{...styles.topicName, color: colors.text}}>{topic.name || topic}</div>
                        <div style={{...styles.topicBarContainer, background: colors.surfaceHover}}>
                          <div style={{
                            ...styles.topicBarFill,
                            width: `${((topic.count || 1) / maxCount) * 100}%`
                          }}></div>
                        </div>
                        <div style={{...styles.topicCount, color: colors.textSecondary}}>{topic.count || 1}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{...styles.emptyState, color: colors.textSecondary}}>No topics identified yet</div>
                )}
              </div>

              {/* Key Decisions */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{...styles.cardTitleNew, color: colors.text}}>Key Decisions</h3>
                  {dashboard.decisions?.length > 5 && (
                    <button 
                      onClick={() => setExpandedModal('decisions')}
                      style={{...styles.viewAllBtn, border: `1px solid ${colors.border}`, color: colors.textSecondary}}
                    >
                      View All ({dashboard.decisions.length})
                    </button>
                  )}
                </div>
                {dashboard.decisions?.length > 0 ? (
                  <div style={styles.timelineList}>
                    {dashboard.decisions.slice(0, 5).map((decision, i) => (
                      <div key={i} style={styles.timelineItem}>
                        <div style={styles.timelineDot}></div>
                        <div style={styles.timelineContent}>
                          <div style={{...styles.timelineText, color: colors.text}}>{decision.text || decision}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{...styles.emptyState, color: colors.textSecondary}}>No decisions recorded yet</div>
                )}
              </div>

              {/* Blockers */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{...styles.cardTitleNew, color: colors.text}}>Blockers</h3>
                  {validBlockers.length > 5 && (
                    <button 
                      onClick={() => setExpandedModal('blockers')}
                      style={{...styles.viewAllBtn, border: `1px solid ${colors.border}`, color: colors.textSecondary}}
                    >
                      View All ({validBlockers.length})
                    </button>
                  )}
                </div>
                {validBlockers.length > 0 ? (
                  <div style={styles.blockersList}>
                    {validBlockers.slice(0, 5).map((blocker, i) => (
                      <div key={i} style={styles.blockerItem}>
                        <div style={{
                          ...styles.severityDot,
                          background: getSeverityColor(blocker.severity || 'medium')
                        }}></div>
                        <div style={{...styles.blockerText, color: colors.text}}>{blocker.text || blocker}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{...styles.emptyState, color: colors.textSecondary}}>No blockers</div>
                )}
              </div>

              {/* Action Items */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{...styles.cardTitleNew, color: colors.text}}>Action Items</h3>
                  {dashboard.actionItems?.length > 5 && (
                    <button 
                      onClick={() => setExpandedModal('actions')}
                      style={{...styles.viewAllBtn, border: `1px solid ${colors.border}`, color: colors.textSecondary}}
                    >
                      View All ({dashboard.actionItems.length})
                    </button>
                  )}
                </div>
                {dashboard.actionItems?.length > 0 ? (
                  <div style={styles.actionList}>
                    {dashboard.actionItems.slice(0, 5).map((action, i) => (
                      <div key={i} style={styles.actionItem}>
                        <div style={styles.actionCheckbox}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            {action.status === 'completed' && <polyline points="20 6 9 17 4 12"/>}
                          </svg>
                        </div>
                        <div style={{...styles.actionText, color: colors.text}}>{action.text || action}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{...styles.emptyState, color: colors.textSecondary}}>No action items</div>
                )}
              </div>
            </div>

            {/* Right Column - Project State */}
            <div style={styles.dashboardRightCol}>

              {/* Blocker Tracker ÔÇö entity model data */}
              {dashboard.enrichedBlockers?.length > 0 && (
                <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`, marginBottom: '16px'}}>
                  <h3 style={{...styles.cardTitleNew, color: colors.text, marginBottom: '16px'}}>Blocker Tracker</h3>
                  <BlockerTracker enrichedBlockers={dashboard.enrichedBlockers} colors={colors} />
                </div>
              )}

              {/* Stage Panel */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <h3 style={{...styles.cardTitleNew, color: colors.text}}>Current Stage</h3>
                <div style={styles.stageDisplay}>
                  <div style={{
                    ...styles.stageBadge,
                    background: getStageColor(dashboard.stage || 'ideation')
                  }}>
                    {(dashboard.stage || 'ideation').charAt(0).toUpperCase() + (dashboard.stage || 'ideation').slice(1)}
                  </div>
                  {dashboard.lastUpdated && (
                    <div style={{...styles.stageUpdated, color: colors.textSecondary}}>
                      Last updated {formatTimestamp(dashboard.lastUpdated)}
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Graph */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <h3 style={{...styles.cardTitleNew, color: colors.text}}>Activity</h3>
                <div style={styles.activityChartCompact}>
                  <div style={styles.chartBarsCompact}>
                    {(dashboard.activity || [0,0,0,0,0,0,0]).map((value, i) => {
                      const maxActivity = Math.max(...(dashboard.activity || [1]), 1);
                      return (
                        <div key={i} style={styles.chartBarWrapperCompact}>
                          <div style={styles.chartBarCompact}>
                            <div style={{
                              ...styles.chartBarFillCompact,
                              height: `${(value / maxActivity) * 100}%`,
                              background: i === 6 ? '#667eea' : 'rgba(102, 126, 234, 0.3)'
                            }}></div>
                          </div>
                          <div style={{...styles.chartBarLabelCompact, color: colors.textSecondary}}>
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Discussion Breakdown */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <h3 style={{...styles.cardTitleNew, color: colors.text}}>Discussion Activity</h3>
                {dashboard.discussionBreakdown?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {dashboard.discussionBreakdown.map((disc, i) => {
                      const maxCount = Math.max(...dashboard.discussionBreakdown.map(d => d.count), 1);
                      const percentage = Math.round((disc.count / dashboard.totalMessages) * 100);
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ 
                              fontSize: '13px', 
                              color: colors.text,
                              fontWeight: '500',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '200px'
                            }}>
                              {disc.title}
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                              {disc.count} ({percentage}%)
                            </div>
                          </div>
                          <div style={{ 
                            height: '6px', 
                            background: colors.surfaceHover, 
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${(disc.count / maxCount) * 100}%`,
                              background: disc.isMain ? '#10b981' : '#667eea',
                              borderRadius: '3px',
                              transition: 'width 0.3s'
                            }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={styles.emptyState}>No discussion data</div>
                )}
              </div>

              {/* Message Types Distribution */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <h3 style={{...styles.cardTitleNew, color: colors.text}}>Message Distribution</h3>
                {dashboard.messageTypes ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {/* Simple pie chart representation */}
                      <div style={{ 
                        width: '80px', 
                        height: '80px', 
                        borderRadius: '50%',
                        background: `conic-gradient(
                          #667eea 0deg ${(dashboard.messageTypes.user / dashboard.totalMessages) * 360}deg,
                          #8b5cf6 ${(dashboard.messageTypes.user / dashboard.totalMessages) * 360}deg 360deg
                        )`,
                        flexShrink: 0
                      }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#667eea' }}></div>
                          <span style={{ fontSize: '13px', color: colors.text }}>User Messages</span>
                          <span style={{ fontSize: '13px', color: colors.textSecondary, marginLeft: 'auto' }}>
                            {dashboard.messageTypes.user} ({Math.round((dashboard.messageTypes.user / dashboard.totalMessages) * 100)}%)
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#8b5cf6' }}></div>
                          <span style={{ fontSize: '13px', color: colors.text }}>AI Responses</span>
                          <span style={{ fontSize: '13px', color: colors.textSecondary, marginLeft: 'auto' }}>
                            {dashboard.messageTypes.ai} ({Math.round((dashboard.messageTypes.ai / dashboard.totalMessages) * 100)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={styles.emptyState}>No message data</div>
                )}
              </div>

              {/* Participants */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <h3 style={{...styles.cardTitleNew, color: colors.text}}>Top Contributors</h3>
                <div style={styles.participantsListCompact}>
                  {dashboard.participants?.map((participant, i) => {
                    const avatarColor = getAvatarColor(participant.username);
                    const initials = getInitials(participant.username);
                    const percentage = Math.round((participant.count / dashboard.totalMessages) * 100);
                    return (
                      <div key={i} style={styles.participantItemCompact}>
                        <div style={{
                          ...styles.participantAvatarCompact,
                          background: avatarColor
                        }}>
                          {initials}
                        </div>
                        <div style={styles.participantInfoCompact}>
                          <div style={{...styles.participantNameCompact, color: colors.text}}>{participant.username}</div>
                          <div style={{...styles.participantTimeCompact, color: colors.textSecondary}}>{participant.count} messages ({percentage}%)</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stats Summary */}
              <div style={{...styles.dashboardCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <h3 style={{...styles.cardTitleNew, color: colors.text}}>Summary</h3>
                <div style={styles.statsSummary}>
                  <div style={styles.summaryRow}>
                    <span style={{...styles.summaryLabel, color: colors.textSecondary}}>Total Messages</span>
                    <span style={{...styles.summaryValue, color: colors.text}}>{dashboard.totalMessages}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={{...styles.summaryLabel, color: colors.textSecondary}}>Documents</span>
                    <span style={{...styles.summaryValue, color: colors.text}}>{dashboard.documentCount}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={{...styles.summaryLabel, color: colors.textSecondary}}>Data Source</span>
                    <span style={{
                      ...styles.summaryValue,
                      color: dashboard.source === 'persistent' ? '#10b981' : '#f59e0b'
                    }}>
                      {dashboard.source === 'persistent' ? 'Cached' : 'Live'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={styles.dashboardError}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>Failed to load dashboard</p>
          <button onClick={loadDashboard} style={styles.retryBtn}>Retry</button>
        </div>
      )}

      {/* Expanded Modals */}
      {expandedModal && dashboard && (
        <div style={styles.modalOverlay} onClick={() => setExpandedModal(null)}>
          <div style={{...styles.modal, background: colors.surface, border: `1px solid ${colors.border}`, maxWidth: '600px', maxHeight: '80vh', overflow: 'auto'}} onClick={(e) => e.stopPropagation()}>
            <div style={{...styles.modalHeader, borderBottom: `1px solid ${colors.border}`}}>
              <h3 style={{...styles.modalTitle, color: colors.text}}>
                {expandedModal === 'topics' && 'All Topics'}
                {expandedModal === 'decisions' && 'All Decisions'}
                {expandedModal === 'blockers' && 'All Blockers'}
                {expandedModal === 'actions' && 'All Action Items'}
              </h3>
              <button onClick={() => setExpandedModal(null)} style={{...styles.modalClose, color: colors.textTertiary}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              {expandedModal === 'topics' && topTopics.map((topic, i) => (
                <div key={i} style={{...styles.topicBarRow, marginBottom: '12px'}}>
                  <div style={{...styles.topicName, color: colors.text}}>{topic.name || topic}</div>
                  <div style={{...styles.topicBarContainer, background: colors.surfaceHover}}>
                    <div style={{...styles.topicBarFill, width: `${((topic.count || 1) / maxCount) * 100}%`}}></div>
                  </div>
                  <div style={{...styles.topicCount, color: colors.textSecondary}}>{topic.count || 1}</div>
                </div>
              ))}
              {expandedModal === 'decisions' && dashboard.decisions.map((decision, i) => (
                <div key={i} style={{...styles.timelineItem, marginBottom: '16px'}}>
                  <div style={styles.timelineDot}></div>
                  <div style={styles.timelineContent}>
                    <div style={{...styles.timelineText, color: colors.text}}>{decision.text || decision}</div>
                  </div>
                </div>
              ))}
              {expandedModal === 'blockers' && validBlockers.map((blocker, i) => (
                <div key={i} style={{...styles.blockerItem, marginBottom: '12px'}}>
                  <div style={{...styles.severityDot, background: getSeverityColor(blocker.severity || 'medium')}}></div>
                  <div style={{...styles.blockerText, color: colors.text}}>{blocker.text || blocker}</div>
                </div>
              ))}
              {expandedModal === 'actions' && dashboard.actionItems.map((action, i) => (
                <div key={i} style={{...styles.actionItem, marginBottom: '12px'}}>
                  <div style={styles.actionCheckbox}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      {action.status === 'completed' && <polyline points="20 6 9 17 4 12"/>}
                    </svg>
                  </div>
                  <div style={{...styles.actionText, color: colors.text}}>{action.text || action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Documents({ project, onClose, token, colors }) {
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);

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
      <div style={{...styles.pageHeader, background: colors.surface, borderBottom: `1px solid ${colors.border}`}}>
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

      <div style={styles.pageContent}>
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
                      {contentSize} KB ÔÇó Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{
                      ...styles.documentMeta,
                      color: hasEmbeddings ? '#10b981' : '#f59e0b',
                      fontSize: '11px',
                      marginTop: '4px'
                    }}>
                      {hasEmbeddings ? 'Ô£ô Embeddings ready' : 'ÔÅ│ Processing embeddings...'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Settings({ project, onClose, token, isOwner, colors }) {
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const copyInviteCode = () => {
    const inviteLink = `${window.location.origin}/join/${project.inviteCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInviteEmail = async () => {
    if (!emailInput.trim()) {
      alert('Please enter an email address');
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
        alert(`Invitation sent to ${emailInput}!`);
        setEmailInput('');
      } else {
        alert(data.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const members = project.members || [];

  return (
    <div style={styles.settingsOverlay}>
      <div style={{...styles.settingsModal, background: colors.surface, border: `1px solid ${colors.border}`}}>
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
              <code style={{...styles.code, background: colors.background, border: `1px solid ${colors.border}`, color: colors.text}}>{`${window.location.origin}/join/${project.inviteCode}`}</code>
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
              <div style={{ display: 'flex', gap: '8px' }}>
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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Summaries({ project, discussion, onClose, token, colors }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editingSummary, setEditingSummary] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/summaries`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        // Filter summaries for current discussion
        const discSummaries = data.summaries.filter(
          s => s.discussionId === discussion._id
        );
        setSummaries(discSummaries);
      }
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async (prompt = null) => {
    setGenerating(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussion._id}/summarize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ customPrompt: prompt })
        }
      );
      const data = await response.json();
      if (data.success) {
        loadSummaries();
      }
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setGenerating(false);
    }
  };

  const regenerateSummary = async (summaryId) => {
    if (!customPrompt.trim()) {
      alert('Please enter refinement instructions');
      return;
    }

    setRegenerating(true);
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussion._id}/summaries/${summaryId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ customPrompt })
        }
      );
      const data = await response.json();
      if (data.success) {
        setEditingSummary(null);
        setCustomPrompt('');
        loadSummaries();
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
    } finally {
      setRegenerating(false);
    }
  };

  const deleteSummary = async (summaryId) => {
    if (!confirm('Delete this summary?')) return;

    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/discussions/${discussion._id}/summaries/${summaryId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      if (data.success) {
        loadSummaries();
      }
    } catch (error) {
      console.error('Error deleting summary:', error);
    }
  };

  return (
    <div style={{...styles.fullPage, background: colors.background}}>
      <div style={{...styles.pageHeader, background: colors.surface, borderBottom: `1px solid ${colors.border}`}}>
        <button onClick={onClose} style={{...styles.backButton, border: `1px solid ${colors.border}`, color: colors.text}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 style={{...styles.pageTitle, color: colors.text}}>Summaries - {discussion.title}</h1>
        <button 
          onClick={() => generateSummary()} 
          style={styles.uploadButton}
          disabled={generating}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          {generating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      <div style={styles.pageContent}>
        {loading ? (
          <div style={styles.emptyState}>
            <p style={{...styles.emptyText, color: colors.textSecondary}}>Loading summaries...</p>
          </div>
        ) : summaries.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{...styles.emptyText, color: colors.textSecondary}}>No summaries yet</p>
            <p style={{...styles.emptyHint, color: colors.textTertiary}}>Generate a summary to capture key points from this discussion</p>
          </div>
        ) : (
          <div style={styles.summariesList}>
            {summaries.map(summary => (
              <div key={summary._id} style={{...styles.summaryCard, background: colors.surface, border: `1px solid ${colors.border}`}}>
                <div style={styles.summaryHeader}>
                  <div style={styles.summaryMeta}>
                    <span style={{...styles.summaryDate, color: colors.text}}>
                      {new Date(summary.createdAt).toLocaleDateString()}
                    </span>
                    <span style={{...styles.summaryProvider, color: colors.textSecondary}}>
                      via {summary.generatedBy}
                    </span>
                  </div>
                  <div style={styles.summaryActions}>
                    <button 
                      onClick={() => setEditingSummary(summary._id)}
                      style={{...styles.summaryActionBtn, color: colors.text}}
                      title="Refine summary"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button 
                      onClick={() => deleteSummary(summary._id)}
                      style={{...styles.summaryActionBtn, color: '#ef4444'}}
                      title="Delete summary"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div style={{...styles.summaryContent, color: colors.text}}>
                  {summary.content}
                </div>

                {editingSummary === summary._id && (
                  <div style={styles.refineBox}>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="How would you like to refine this summary? (e.g., 'Make it more concise', 'Focus on technical decisions', 'Add action items')"
                      style={styles.refineInput}
                      rows={3}
                    />
                    <div style={styles.refineActions}>
                      <button 
                        onClick={() => {
                          setEditingSummary(null);
                          setCustomPrompt('');
                        }}
                        style={styles.refineCancelBtn}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => regenerateSummary(summary._id)}
                        style={styles.refineSubmitBtn}
                        disabled={regenerating || !customPrompt.trim()}
                      >
                        {regenerating ? 'Refining...' : 'Refine Summary'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AllDiscussionSummaries({ project, discussions, onClose, token, colors }) {
  const [summariesByDisc, setSummariesByDisc] = useState({});
  const [loading, setLoading] = useState(true);

  const parallelDiscussions = discussions.filter(d => !d.isMain);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const response = await apiRequest(
        `/api/projects/${project._id}/summaries`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (data.success) {
        // Group by discussionId
        const grouped = {};
        data.summaries.forEach(s => {
          const key = s.discussionId;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(s);
        });
        setSummariesByDisc(grouped);
      }
    } catch (err) {
      console.error('Error loading all summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const relativeTime = (date) => {
    if (!date) return '';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div style={{...styles.fullPage, background: colors.background}}>
      <div style={{...styles.pageHeader, background: colors.surface, borderBottom: `1px solid ${colors.border}`}}>
        <button onClick={onClose} style={{...styles.backButton, border: `1px solid ${colors.border}`, color: colors.text}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 style={{...styles.pageTitle, color: colors.text}}>Discussion Summaries</h1>
        <div style={{ width: '100px' }} />
      </div>

      <div style={styles.pageContent}>
        {loading ? (
          <div style={styles.emptyState}>
            <p style={{color: colors.textSecondary}}>Loading...</p>
          </div>
        ) : parallelDiscussions.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{color: colors.textSecondary}}>No parallel discussions yet</p>
          </div>
        ) : (
          <div style={styles.summariesList}>
            {parallelDiscussions.map(disc => {
              const discSummaries = summariesByDisc[disc._id] || [];
              const msgCount = disc.messageCount || 0;
              const latestSummary = discSummaries[0];
              const isStaleSummary = latestSummary && (msgCount - (latestSummary.messageCountAtSummary || 0)) >= 10;

              return (
                <div key={disc._id} style={{...styles.summaryCard, background: colors.surface, border: `1px solid ${colors.border}`, marginBottom: '20px'}}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <span style={{ color: colors.text, fontWeight: '600', fontSize: '15px' }}>{disc.title}</span>
                      {isStaleSummary && (
                        <span title="Summary may be outdated ÔÇö discussion has grown significantly" style={{ fontSize: '13px' }}>ÔÜá´©Å stale</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: colors.textTertiary }}>
                      {msgCount > 0 && <span>{msgCount} messages</span>}
                      {disc.lastActivity && <span>active {relativeTime(disc.lastActivity)}</span>}
                    </div>
                  </div>

                  {discSummaries.length === 0 ? (
                    <p style={{ color: colors.textTertiary, fontSize: '13px', fontStyle: 'italic' }}>No summary yet</p>
                  ) : (
                    discSummaries.map(s => (
                      <div key={s._id} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${colors.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                            {new Date(s.createdAt).toLocaleDateString()} ┬À via {s.generatedBy}
                          </span>
                          {s.messageCountAtSummary > 0 && (
                            <span style={{ fontSize: '12px', color: colors.textTertiary }}>
                              at {s.messageCountAtSummary} messages
                            </span>
                          )}
                        </div>
                        <div style={{ color: colors.text, fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                          {s.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
