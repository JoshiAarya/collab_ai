import React, { useState } from "react";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './components/Auth';
import ProjectList from './components/ProjectList';
import ProjectWorkspace from './components/ProjectWorkspace';

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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = {
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
    color: '#fff',
    fontSize: 18
  }
};
