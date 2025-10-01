import { Toaster } from 'react-hot-toast';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProjectProvider } from './contexts/ProjectContext';
import { ClaudeDocsPage } from './pages/ClaudeDocsPage';
import { ClaudeProjectsPage } from './pages/ClaudeProjectsPage';
import { ControllerDocsPage } from './pages/ControllerDocsPage';
import { ExecutePage } from './pages/ExecutePage';
import { IndexPage } from './pages/IndexPage';
import { McpConfigsPage } from './pages/McpConfigsPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <ProjectProvider>
      <HashRouter>
        <Toaster position="top-right" />
        <Layout>
          <Routes>
            <Route path="/" element={<ExecutePage />} />
            <Route path="/index" element={<IndexPage />} />
            <Route path="/claude-projects" element={<ClaudeProjectsPage />} />
            <Route path="/claude-projects/:projectDirName" element={<ClaudeProjectsPage />} />
            <Route
              path="/claude-projects/:projectDirName/:sessionId"
              element={<ClaudeProjectsPage />}
            />
            <Route path="/mcp-configs" element={<McpConfigsPage />} />
            <Route path="/claude-docs" element={<ClaudeDocsPage />} />
            <Route path="/controller-docs" element={<ControllerDocsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </ProjectProvider>
  );
}

export default App;
