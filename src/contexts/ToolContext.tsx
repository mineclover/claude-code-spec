/**
 * Tool Context
 * Manages the currently selected CLI tool (claude/codex/gemini)
 * Persisted to localStorage
 */

import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

export type ToolId = 'claude' | 'codex' | 'gemini';

interface ToolContextValue {
  selectedToolId: ToolId;
  setSelectedToolId: (id: ToolId) => void;
}

const STORAGE_KEY = 'selectedToolId';
const DEFAULT_TOOL: ToolId = 'claude';

function loadToolId(): ToolId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'claude' || stored === 'codex' || stored === 'gemini') {
      return stored;
    }
  } catch {
    // ignore
  }
  return DEFAULT_TOOL;
}

const ToolContext = createContext<ToolContextValue | undefined>(undefined);

export function ToolProvider({ children }: { children: ReactNode }) {
  const [selectedToolId, setSelectedToolIdState] = useState<ToolId>(loadToolId);

  const setSelectedToolId = useCallback((id: ToolId) => {
    setSelectedToolIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  return (
    <ToolContext.Provider value={{ selectedToolId, setSelectedToolId }}>
      {children}
    </ToolContext.Provider>
  );
}

export function useToolContext() {
  const context = useContext(ToolContext);
  if (!context) throw new Error('useToolContext must be used within a ToolProvider');
  return context;
}
