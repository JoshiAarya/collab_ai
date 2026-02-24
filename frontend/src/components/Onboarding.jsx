import React, { useState } from 'react';

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to CollabAI! 🎉",
      description: "Your AI-powered collaboration workspace where teams work smarter together.",
      icon: (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      ),
      color: '#8b5cf6'
    },
    {
      title: "Create Projects",
      description: "Start a new project and invite your team to collaborate in real-time. Each project has its own workspace with discussions, documents, and AI assistance.",
      icon: (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      color: '#10a37f'
    },
    {
      title: "AI-Powered Discussions",
      description: "Mention @CollabAI in any discussion to get intelligent assistance. The AI understands your project context, documents, and conversation history.",
      icon: (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      color: '#f59e0b'
    },
    {
      title: "Smart Insights",
      description: "Get automatic summaries, track decisions, identify blockers, and receive strategic signals about your project's progress.",
      icon: (
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3v18h18"/>
          <path d="M18 17V9"/>
          <path d="M13 17V5"/>
          <path d="M8 17v-3"/>
        </svg>
      ),
      color: '#3b82f6'
    }
  ];

  const currentStep = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('onboarding-completed', 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding-completed', 'true');
    onComplete();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button onClick={handleSkip} style={styles.skipButton}>
          Skip
        </button>

        <div style={{
          ...styles.iconContainer,
          color: currentStep.color
        }}>
          {currentStep.icon}
        </div>

        <h2 style={styles.title}>{currentStep.title}</h2>
        <p style={styles.description}>{currentStep.description}</p>

        <div style={styles.dots}>
          {steps.map((_, index) => (
            <div
              key={index}
              style={{
                ...styles.dot,
                background: index === step ? '#8b5cf6' : '#2d2d2d'
              }}
            />
          ))}
        </div>

        <button onClick={handleNext} style={styles.button}>
          {step < steps.length - 1 ? 'Next' : 'Get Started'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    animation: 'fadeIn 0.3s ease-out'
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '20px',
    padding: '60px 40px 40px',
    maxWidth: '500px',
    width: '90%',
    textAlign: 'center',
    border: '1px solid #2d2d2d',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    position: 'relative',
    animation: 'slideUp 0.4s ease-out'
  },
  skipButton: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px 16px',
    borderRadius: '6px',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  iconContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '32px',
    animation: 'scaleIn 0.5s ease-out'
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#ececec',
    marginBottom: '16px',
    lineHeight: '1.3'
  },
  description: {
    fontSize: '16px',
    color: '#b4b4b4',
    lineHeight: '1.7',
    marginBottom: '40px',
    maxWidth: '400px',
    margin: '0 auto 40px'
  },
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '32px'
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transition: 'all 0.3s'
  },
  button: {
    width: '100%',
    padding: '16px',
    background: '#8b5cf6',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  }
};
