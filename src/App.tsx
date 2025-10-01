import { HashRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { ClaudeProjectsPage } from './pages/ClaudeProjectsPage';
import { ClaudeDocsPage } from './pages/ClaudeDocsPage';
import { ControllerDocsPage } from './pages/ControllerDocsPage';
import { ExecutePage } from './pages/ExecutePage';
import { IndexPage } from './pages/IndexPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <HashRouter>
      <Toaster position="top-right" />
      <Layout>
        <Routes>
          <Route path="/" element={<ExecutePage />} />
          <Route path="/index" element={<IndexPage />} />
          <Route path="/claude-projects" element={<ClaudeProjectsPage />} />
          <Route path="/claude-projects/:projectDirName" element={<ClaudeProjectsPage />} />
          <Route path="/claude-projects/:projectDirName/:sessionId" element={<ClaudeProjectsPage />} />
          <Route path="/claude-docs" element={<ClaudeDocsPage />} />
          <Route path="/controller-docs" element={<ControllerDocsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
