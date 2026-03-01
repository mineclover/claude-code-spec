import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SessionLogViewer } from '../components/sessions/SessionLogViewer';

export const ClaudeSessionDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectDirName, sessionId } = useParams<{
    projectDirName: string;
    sessionId: string;
  }>();
  const [projectPath, setProjectPath] = useState<string>('');

  // Decode projectDirName to get projectPath
  useEffect(() => {
    if (projectDirName) {
      // Convert projectDirName format to path
      // Example: -Users-junwoobang-project-name -> /Users/junwoobang/project-name
      const path = `/${projectDirName.replace(/^-/, '').replace(/-/g, '/')}`;
      setProjectPath(path);
    }
  }, [projectDirName]);

  const handleClose = () => {
    if (projectDirName) {
      navigate(`/claude-projects/${projectDirName}`);
    }
  };

  const handleViewAnalysis = () => {
    if (projectDirName && sessionId) {
      navigate(`/claude-projects/${projectDirName}/sessions/${sessionId}/analysis`);
    }
  };

  if (!projectPath || !sessionId) {
    return <div>Loading...</div>;
  }

  return (
    <SessionLogViewer
      projectPath={projectPath}
      sessionId={sessionId}
      onClose={handleClose}
      onViewAnalysis={handleViewAnalysis}
    />
  );
};
