import React, { useState } from "react";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import ProjectList from './components/ProjectList';
import ProjectWorkspace from './components/ProjectWorkspace';
import ErrorBoundary from './components/shared/ErrorBoundary';

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedProject, setSelectedProject] = useState(null);

  if (loading) {
    return (
      <div style={styles.loading}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (selectedProject) {
    return (
      <ProjectWorkspace 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)} 
      />
    );
  }

  return <ProjectList onSelectProject={setSelectedProject} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d0d0d',
    color: '#ececec',
    fontSize: 18
  }
};
