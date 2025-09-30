/**
 * SessionManager - Manages Claude CLI sessions and their history
 */

export interface SessionInfo {
  sessionId: string;
  cwd: string;
  query: string;
  timestamp: number;
  lastResult?: string;
}

export class SessionManager {
  private sessions: Map<string, SessionInfo> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Create or update a session
   */
  saveSession(sessionId: string, info: Omit<SessionInfo, 'sessionId'>): void {
    const session: SessionInfo = {
      sessionId,
      ...info,
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;

    console.log('[SessionManager] Saved session:', sessionId);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions sorted by timestamp (most recent first)
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Set current session ID
   */
  setCurrentSessionId(sessionId: string | null): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Update session with result
   */
  updateSessionResult(sessionId: string, result: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastResult = result;
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Clear all sessions
   */
  clearSessions(): void {
    this.sessions.clear();
    this.currentSessionId = null;
    console.log('[SessionManager] Cleared all sessions');
  }

  /**
   * Remove a specific session
   */
  removeSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted && this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
    return deleted;
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}