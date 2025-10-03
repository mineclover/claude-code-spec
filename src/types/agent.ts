export interface AgentMetadata {
  name: string; // 필수: Agent 고유 식별자 (e.g., "test-generator")
  description: string; // 필수: Agent 역할 및 목적 요약
  allowedTools?: string[]; // 선택: 허용된 도구 목록 (e.g., ["Read", "Write", "Bash"])
  permissions?: {
    allowList?: string[]; // 허용 패턴 (e.g., ["read:src/**", "write:tests/**"])
    denyList?: string[]; // 거부 패턴 (e.g., ["write:src/**", "read:.env"])
  };
}

export interface Agent extends AgentMetadata {
  content: string; // 마크다운 body (Role, Process, Constraints, Output Format 등)
  filePath: string; // 파일 전체 경로
  source: 'project' | 'user'; // 프로젝트 레벨 또는 사용자 레벨
}

export interface AgentListItem {
  name: string;
  description: string;
  source: 'project' | 'user';
  filePath: string;
  allowedToolsCount?: number; // 허용된 도구 개수 (UI 표시용)
  hasPermissions?: boolean; // 권한 설정 여부 (UI 표시용)
}
