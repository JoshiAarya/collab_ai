import React, { useState } from 'react';
import { IoSettingsOutline } from 'react-icons/io5';
import { MdChevronRight } from 'react-icons/md';

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
      </svg>
    ),
    color: '#10a37f',
    models: [
      { id: 'gpt-5-1', name: 'gpt-5-1' },
      { id: 'gpt-5-1-chat-latest', name: 'gpt-5-1-chat-latest' },
      { id: 'gpt-5', name: 'gpt-5' },
      { id: 'gpt-5-chat-latest', name: 'gpt-5-chat-latest' },
      { id: 'gpt-5-mini', name: 'gpt-5-mini' },
      { id: 'gpt-5-nano', name: 'gpt-5-nano' },
      { id: 'gpt-5-pro', name: 'gpt-5-pro' },
      { id: 'gpt-5-1-codex', name: 'gpt-5-1-codex' },
      { id: 'gpt-5-codex', name: 'gpt-5-codex' },
      { id: 'gpt-5-1-codex-mini', name: 'gpt-5-1-codex-mini' },
      { id: 'codex-mini-latest', name: 'codex-mini-latest' },
      { id: 'gpt-5-search-api', name: 'gpt-5-search-api' },
      { id: 'gpt-4-1', name: 'gpt-4-1' },
      { id: 'gpt-4o', name: 'gpt-4o' },
      { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
      { id: 'gpt-4-turbo', name: 'gpt-4-turbo' },
      { id: 'gpt-4', name: 'gpt-4' },
      { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo' }
    ]
  },
  anthropic: {
    name: 'Anthropic',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
      </svg>
    ),
    color: '#d4a574',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
    ]
  },
  google: {
    name: 'Google',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
    color: '#4285F4',
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' }
    ]
  },
  deepseek: {
    name: 'DeepSeek',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
      </svg>
    ),
    color: '#00a6fb',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' }
    ]
  },
  xai: {
    name: 'xAI',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    color: '#ffffff',
    models: [
      { id: 'grok-beta', name: 'Grok Beta' },
      { id: 'grok-2-latest', name: 'Grok 2' }
    ]
  },
  server: {
    name: 'Server',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
        <line x1="6" y1="6" x2="6.01" y2="6"/>
        <line x1="6" y1="18" x2="6.01" y2="18"/>
      </svg>
    ),
    color: '#8b5cf6',
    models: [
      { id: 'server', name: 'Server' }
    ]
  }
};

export default function ModelSelector({ currentModel, onModelChange, projectId, token }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyProvider, setApiKeyProvider] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentProviderInfo = PROVIDERS[currentModel.provider] || PROVIDERS.server;
  const currentModelInfo = currentProviderInfo.models.find(m => m.id === currentModel.model) || currentProviderInfo.models[0];

  const handleModelSelect = async (providerId, modelId) => {
    const newModel = { provider: providerId, model: modelId };
    
    try {
      const response = await fetch(`http://localhost:8080/api/projects/${projectId}/llm`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activeLLM: newModel })
      });

      if (response.ok) {
        onModelChange(newModel);
        setShowDropdown(false);
        setSelectedProvider(null);
      }
    } catch (error) {
      console.error('Error updating model:', error);
    }
  };

  const handleApiKeySubmit = async () => {
    if (!apiKey.trim()) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:8080/api/projects/${projectId}/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          provider: apiKeyProvider,
          apiKey: apiKey.trim()
        })
      });

      if (response.ok) {
        setShowApiKeyModal(false);
        setApiKey('');
        setApiKeyProvider(null);
        alert('API key saved successfully!');
      } else {
        alert('Failed to save API key');
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      alert('Error saving API key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProviders = Object.entries(PROVIDERS).filter(([id, provider]) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return provider.name.toLowerCase().includes(query) ||
           provider.models.some(m => m.name.toLowerCase().includes(query));
  });

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        style={styles.modelSelector}
      >
        <span style={{ fontSize: '18px' }}>{currentProviderInfo.icon}</span>
        <span style={{ fontWeight: '500' }}>{currentModelInfo.name}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {showDropdown && (
        <>
          <div style={styles.backdrop} onClick={() => {
            setShowDropdown(false);
            setSelectedProvider(null);
          }} />
          <div style={styles.dropdown}>
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
              autoFocus
            />
            
            <div style={styles.content}>
              {!selectedProvider ? (
                // Provider list
                filteredProviders.map(([id, provider]) => (
                  <div 
                    key={id} 
                    style={styles.providerRow}
                    onClick={() => {
                      // For server, select directly without showing models
                      if (id === 'server') {
                        handleModelSelect('server', 'server');
                      }
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{...styles.providerIcon, color: provider.color}}>{provider.icon}</span>
                    <span style={styles.providerName}>{provider.name}</span>
                    <div style={{ flex: 1 }} />
                    
                    {/* Settings icon - only for non-server providers */}
                    {id !== 'server' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setApiKeyProvider(id);
                          setShowApiKeyModal(true);
                          setShowDropdown(false);
                        }}
                        style={styles.iconBtn}
                        title="Set API Key"
                      >
                        <IoSettingsOutline size={18} />
                      </button>
                    )}

                    {/* Arrow icon - only for non-server providers */}
                    {id !== 'server' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProvider(id);
                        }}
                        style={styles.iconBtn}
                        title="View Models"
                      >
                        <MdChevronRight size={18} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                // Model list
                <>
                  <div style={styles.backButton} onClick={() => setSelectedProvider(null)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                    <span>Back to providers</span>
                  </div>
                  {PROVIDERS[selectedProvider].models.map(model => (
                    <div
                      key={model.id}
                      onClick={() => handleModelSelect(selectedProvider, model.id)}
                      style={{
                        ...styles.modelRow,
                        background: currentModel.provider === selectedProvider && currentModel.model === model.id 
                          ? 'rgba(16, 163, 127, 0.1)' 
                          : 'transparent'
                      }}
                    >
                      <span style={styles.modelName}>{model.name}</span>
                      {currentModel.provider === selectedProvider && currentModel.model === model.id && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10a37f" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5"/>
                        </svg>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showApiKeyModal && (
        <div style={styles.modalOverlay} onClick={() => setShowApiKeyModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Set API Key for {PROVIDERS[apiKeyProvider]?.name}</h3>
              <button onClick={() => setShowApiKeyModal(false)} style={styles.closeBtn}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <div style={styles.modalBody}>
              <p style={styles.modalDesc}>
                {apiKeyProvider === 'server' 
                  ? 'Server uses the backend AI. No configuration needed.'
                  : `Enter your ${PROVIDERS[apiKeyProvider]?.name} API key to use their models.`
                }
              </p>
              
              {apiKeyProvider !== 'server' && (
                <>
                  <label style={styles.inputLabel}>API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter your ${PROVIDERS[apiKeyProvider]?.name} API key`}
                    style={styles.input}
                    autoFocus
                  />
                  
                  <div style={styles.modalActions}>
                    <button onClick={() => setShowApiKeyModal(false)} style={styles.cancelBtn}>
                      Cancel
                    </button>
                    <button onClick={handleApiKeySubmit} style={styles.submitBtn} disabled={!apiKey.trim() || isSubmitting}>
                      {isSubmitting ? 'Saving...' : 'Save Key'}
                    </button>
                  </div>
                </>
              )}
              
              {apiKeyProvider === 'server' && (
                <div style={styles.modalActions}>
                  <button onClick={() => setShowApiKeyModal(false)} style={styles.submitBtn}>
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  modelSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'background 0.2s'
  },
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '8px',
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: '12px',
    minWidth: '360px',
    maxHeight: '500px',
    overflowY: 'auto',
    zIndex: 1000,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
  },
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    background: '#0d0d0d',
    border: 'none',
    borderBottom: '1px solid #2d2d2d',
    borderRadius: '12px 12px 0 0',
    color: '#ececec',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  content: {
    padding: '8px 0'
  },
  providerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  providerIcon: {
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  providerName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececec'
  },
  iconBtn: {
    padding: '6px',
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.2s'
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    cursor: 'pointer',
    color: '#6b6b6b',
    fontSize: '14px',
    borderBottom: '1px solid #2d2d2d'
  },
  modelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  modelName: {
    fontSize: '14px',
    color: '#ececec'
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
    zIndex: 2000
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '12px',
    minWidth: '500px',
    maxWidth: '90%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
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
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b6b6b',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  modalBody: {
    padding: '24px'
  },
  modalDesc: {
    fontSize: '14px',
    color: '#b4b4b4',
    marginBottom: '20px',
    lineHeight: '1.5'
  },
  inputLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#ececec',
    marginBottom: '8px'
  },
  input: {
    width: '100%',
    padding: '12px',
    background: '#0d0d0d',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
    marginBottom: '20px'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end'
  },
  cancelBtn: {
    padding: '10px 20px',
    background: 'transparent',
    border: '1px solid #2d2d2d',
    borderRadius: '8px',
    color: '#ececec',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px'
  },
  submitBtn: {
    padding: '10px 20px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: '600'
  }
};
