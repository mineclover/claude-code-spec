import { Toaster } from 'react-hot-toast';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProjectProvider } from './contexts/ProjectContext';
import { ClaudeDocsPage } from './pages/ClaudeDocsPage';
import { ClaudeProjectsListPage } from './pages/ClaudeProjectsListPage';
import { ClaudeSessionDetailPage } from './pages/ClaudeSessionDetailPage';
import { ClaudeSessionsListPage } from './pages/ClaudeSessionsListPage';
import { ControllerDocsPage } from './pages/ControllerDocsPage';
import { ExecutionDetailPage } from './pages/ExecutionDetailPage';
import { ExecutionsPage } from './pages/ExecutionsPage';
import { IndexPage } from './pages/IndexPage';
import { McpConfigsPage } from './pages/McpConfigsPage';
import { MemoryPage } from './pages/MemoryPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <ProjectProvider>
      <HashRouter>
        <Toaster position="top-right" />
        <Layout>
          <Routes>
            <Route path="/" element={<ExecutionsPage />} />
            <Route path="/executions/:sessionId" element={<ExecutionDetailPage />} />
            <Route path="/index" element={<IndexPage />} />
            <Route path="/claude-projects" element={<ClaudeProjectsListPage />} />
            <Route path="/claude-projects/:projectDirName" element={<ClaudeSessionsListPage />} />
            <Route
              path="/claude-projects/:projectDirName/:sessionId"
              element={<ClaudeSessionDetailPage />}
            />
            <Route path="/mcp-configs" element={<McpConfigsPage />} />
            <Route path="/claude-docs" element={<ClaudeDocsPage />} />
            <Route path="/controller-docs" element={<ControllerDocsPage />} />
            <Route path="/memory" element={<MemoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </HashRouter>
    </ProjectProvider>
  );
}

export default App;
