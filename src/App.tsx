import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { BookmarksPage } from './pages/BookmarksPage';
import { ClaudeProjectsPage } from './pages/ClaudeProjectsPage';
import { ExecutePage } from './pages/ExecutePage';
import { SessionsPage } from './pages/SessionsPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ExecutePage />} />
          <Route path="/sessions" element={<SessionsPage />} />
          <Route path="/claude-projects" element={<ClaudeProjectsPage />} />
          <Route path="/bookmarks" element={<BookmarksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
