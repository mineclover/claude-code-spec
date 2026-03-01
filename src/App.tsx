/**
 * App - main routes
 */

import { Toaster } from 'react-hot-toast';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProjectProvider } from './contexts/ProjectContext';
import { ToolProvider } from './contexts/ToolContext';
import { ExecutePage } from './pages/ExecutePage';
import { McpConfigsPage } from './pages/McpConfigsPage';
import { ReferenceHooksPage } from './pages/ReferenceHooksPage';
import { ReferenceOutputStylesPage } from './pages/ReferenceOutputStylesPage';
import { ReferenceProvidersPage } from './pages/ReferenceProvidersPage';
import { ReferenceSkillsPage } from './pages/ReferenceSkillsPage';
import { SessionsPage } from './pages/SessionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SkillsPage } from './pages/SkillsPage';

function App() {
  return (
    <ToolProvider>
      <ProjectProvider>
        <HashRouter>
          <Toaster position="top-right" />
          <Layout>
            <Routes>
              <Route path="/" element={<ExecutePage />} />
              <Route path="/sessions" element={<SessionsPage />} />
              <Route path="/mcp-configs" element={<McpConfigsPage />} />
              <Route path="/skills" element={<SkillsPage />} />
              <Route path="/references" element={<ReferenceProvidersPage />} />
              <Route path="/references/hooks" element={<ReferenceHooksPage />} />
              <Route path="/references/output-styles" element={<ReferenceOutputStylesPage />} />
              <Route path="/references/skills" element={<ReferenceSkillsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Layout>
        </HashRouter>
      </ProjectProvider>
    </ToolProvider>
  );
}

export default App;
