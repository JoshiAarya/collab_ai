import React, { useState } from 'react';
import { IoSettingsOutline } from 'react-icons/io5';
import { MdChevronRight } from 'react-icons/md';

const PROVIDERS = {
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
    models: [
      { id: 'server', name: 'Server' }
    ]
  },
  openai: {
    name: 'OpenAI',
    icon: '⚪',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🟤',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
    ]
  },
  google: {
    name: 'Google',
    icon: '🔵',
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
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
                  >
                    <span style={styles.providerIcon}>{provider.icon}</span>
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
    transition: 'background 0.2s',
    ':hover': {
      background: 'rgba(255,255,255,0.05)'
    }
  },
  providerIcon: {
    fontSize: '20px'
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
