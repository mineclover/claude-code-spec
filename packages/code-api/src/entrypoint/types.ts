/**
 * Entry Point System Types
 *
 * Entry Point는 output style, 옵션, 스키마를 미리 설정해두고
 * 쿼리만 받아서 일관된 형식으로 실행하는 진입점입니다.
 */

/**
 * 출력 형식 정의
 */
export interface OutputFormat {
  /** 출력 타입 */
  type: 'text' | 'json' | 'structured';
  /** 스키마 파일 경로 (structured인 경우) */
  schema?: string;
  /** 스키마 이름 (미리 정의된 스키마) */
  schemaName?: string;
}

/**
 * 진입점 설정
 */
export interface EntryPointConfig {
  /** 진입점 이름 (고유 ID) */
  name: string;

  /** 진입점 설명 */
  description: string;

  /** 출력 스타일 이름 (.claude/output-styles/*.md) */
  outputStyle?: string;

  /** 출력 형식 */
  outputFormat: OutputFormat;

  /** 실행 옵션 */
  options?: {
    /** 모델 선택 */
    model?: 'sonnet' | 'opus' | 'haiku';
    /** MCP 설정 파일 경로 */
    mcpConfig?: string;
    /** 타임아웃 (ms) */
    timeout?: number;
    /** Thinking 필터링 여부 */
    filterThinking?: boolean;
  };

  /** 사용 예시 */
  examples?: string[];

  /** 태그 (분류용) */
  tags?: string[];
}

/**
 * 진입점 설정 파일 구조
 */
export interface EntryPointsConfig {
  /** 버전 */
  version: string;

  /** 진입점 목록 */
  entryPoints: Record<string, EntryPointConfig>;
}

/**
 * 진입점 실행 파라미터
 */
export interface ExecuteEntryPointParams {
  /** 진입점 이름 */
  entryPoint: string;

  /** 실행할 쿼리 */
  query: string;

  /** 프로젝트 경로 */
  projectPath: string;

  /** 옵션 오버라이드 */
  options?: {
    model?: 'sonnet' | 'opus' | 'haiku';
    mcpConfig?: string;
    timeout?: number;
  };
}

/**
 * 진입점 실행 결과
 */
export interface EntryPointResult<T = any> {
  /** 성공 여부 */
  success: boolean;

  /** 파싱된 데이터 (structured인 경우) */
  data?: T;

  /** 원본 텍스트 결과 */
  rawResult?: string;

  /** 에러 메시지 */
  error?: string;

  /** 실행 메타데이터 */
  metadata: {
    entryPoint: string;
    duration: number;
    model: string;
    tokens?: {
      input: number;
      output: number;
    };
  };
}

/**
 * 스키마 정의
 */
export interface SchemaDefinition {
  /** 스키마 이름 */
  name: string;

  /** 스키마 설명 */
  description: string;

  /** JSON Schema */
  schema: Record<string, any>;

  /** 예제 데이터 */
  examples?: any[];
}

/**
 * 진입점 검증 결과
 */
export interface ValidationResult {
  /** 유효 여부 */
  valid: boolean;

  /** 에러 메시지 */
  errors: string[];

  /** 경고 메시지 */
  warnings: string[];
}
