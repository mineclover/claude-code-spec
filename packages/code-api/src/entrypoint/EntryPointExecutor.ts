/**
 * Entry Point Executor
 *
 * 진입점을 통해 쿼리를 실행하는 클래스
 */

import { ClaudeQueryAPI } from '../query/ClaudeQueryAPI';
import { buildSchemaPrompt, validateAgainstSchema, type JSONSchema } from '../schema/schemaBuilder';
import { extractJSON } from '../schema/jsonExtractor';
import type { ExecuteEntryPointParams, EntryPointResult } from './types';
import { EntryPointManager } from './EntryPointManager';
import { SchemaManager } from './SchemaManager';

export class EntryPointExecutor {
  private entryPointManager: EntryPointManager;
  private schemaManager: SchemaManager;
  private queryAPI: ClaudeQueryAPI;

  constructor(projectPath: string) {
    this.entryPointManager = new EntryPointManager(projectPath);
    this.schemaManager = new SchemaManager(projectPath);
    this.queryAPI = new ClaudeQueryAPI();
  }

  /**
   * 진입점을 통해 쿼리 실행
   */
  async execute<T = any>(params: ExecuteEntryPointParams): Promise<EntryPointResult<T>> {
    const startTime = Date.now();

    try {
      // 진입점 로드
      const entryPoint = this.entryPointManager.getEntryPoint(params.entryPoint);

      if (!entryPoint) {
        return {
          success: false,
          error: `Entry point not found: ${params.entryPoint}`,
          metadata: {
            entryPoint: params.entryPoint,
            duration: Date.now() - startTime,
            model: 'unknown',
          },
        };
      }

      console.log(`\n[EntryPoint: ${entryPoint.name}]`);
      console.log(`Description: ${entryPoint.description}`);
      console.log(`Output Format: ${entryPoint.outputFormat.type}`);

      // 옵션 병합 (파라미터 > 진입점 설정)
      const model = params.options?.model || entryPoint.options?.model;
      const mcpConfig = params.options?.mcpConfig || entryPoint.options?.mcpConfig;
      const timeout = params.options?.timeout || entryPoint.options?.timeout;
      const filterThinking = entryPoint.options?.filterThinking ?? true;

      // 출력 형식에 따라 실행
      let result: EntryPointResult<T>;

      switch (entryPoint.outputFormat.type) {
        case 'structured':
          result = await this.executeStructured<T>(params, entryPoint, {
            model,
            mcpConfig,
            timeout,
            filterThinking,
          });
          break;

        case 'json':
          result = await this.executeJSON<T>(params, entryPoint, {
            model,
            mcpConfig,
            timeout,
            filterThinking,
          });
          break;

        case 'text':
        default:
          result = await this.executeText(params, entryPoint, {
            model,
            mcpConfig,
            timeout,
            filterThinking,
          });
          break;
      }

      // 실행 시간 업데이트
      result.metadata.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          entryPoint: params.entryPoint,
          duration: Date.now() - startTime,
          model: 'unknown',
        },
      };
    }
  }

  /**
   * Structured 형식으로 실행 (스키마 검증)
   */
  private async executeStructured<T>(
    params: ExecuteEntryPointParams,
    entryPoint: any,
    options: any,
  ): Promise<EntryPointResult<T>> {
    // 스키마 로드
    const schemaName = entryPoint.outputFormat.schemaName || entryPoint.outputFormat.schema?.replace('.json', '');

    if (!schemaName) {
      return {
        success: false,
        error: 'Schema not specified',
        metadata: {
          entryPoint: params.entryPoint,
          duration: 0,
          model: options.model || 'sonnet',
        },
      };
    }

    const schemaDefinition = this.schemaManager.loadSchema(schemaName);

    if (!schemaDefinition) {
      return {
        success: false,
        error: `Schema not found: ${schemaName}`,
        metadata: {
          entryPoint: params.entryPoint,
          duration: 0,
          model: options.model || 'sonnet',
        },
      };
    }

    console.log(`Using schema: ${schemaDefinition.name}`);

    // 스키마 프롬프트 생성
    const schemaPrompt = buildSchemaPrompt(schemaDefinition.schema as JSONSchema, params.query);

    // 쿼리 실행
    const queryResult = await this.queryAPI.query(params.projectPath, schemaPrompt, {
      outputStyle: entryPoint.outputStyle,
      model: options.model,
      mcpConfig: options.mcpConfig,
      timeout: options.timeout,
      filterThinking: options.filterThinking,
    });

    // JSON 추출
    const extracted = extractJSON<T>(queryResult.result);

    if (!extracted.success) {
      return {
        success: false,
        error: extracted.error,
        rawResult: queryResult.result,
        metadata: {
          entryPoint: params.entryPoint,
          duration: queryResult.metadata.durationMs,
          model: options.model || 'sonnet',
        },
      };
    }

    // 스키마 검증
    const validation = validateAgainstSchema(extracted.data, schemaDefinition.schema as JSONSchema);

    if (!validation.valid) {
      console.warn('Schema validation warnings:', validation.errors);
    }

    return {
      success: true,
      data: extracted.data as T,
      rawResult: queryResult.result,
      metadata: {
        entryPoint: params.entryPoint,
        duration: queryResult.metadata.durationMs,
        model: options.model || 'sonnet',
      },
    };
  }

  /**
   * JSON 형식으로 실행 (스키마 없음)
   */
  private async executeJSON<T>(
    params: ExecuteEntryPointParams,
    entryPoint: any,
    options: any,
  ): Promise<EntryPointResult<T>> {
    const enhancedQuery = `${params.query}\n\nRespond with valid JSON only.`;

    const queryResult = await this.queryAPI.query(params.projectPath, enhancedQuery, {
      outputStyle: entryPoint.outputStyle || 'json',
      model: options.model,
      mcpConfig: options.mcpConfig,
      timeout: options.timeout,
      filterThinking: options.filterThinking,
    });

    const extracted = extractJSON<T>(queryResult.result);

    if (!extracted.success) {
      return {
        success: false,
        error: extracted.error,
        rawResult: queryResult.result,
        metadata: {
          entryPoint: params.entryPoint,
          duration: queryResult.metadata.durationMs,
          model: options.model || 'sonnet',
        },
      };
    }

    return {
      success: true,
      data: extracted.data as T,
      rawResult: queryResult.result,
      metadata: {
        entryPoint: params.entryPoint,
        duration: queryResult.metadata.durationMs,
        model: options.model || 'sonnet',
      },
    };
  }

  /**
   * Text 형식으로 실행
   */
  private async executeText(
    params: ExecuteEntryPointParams,
    entryPoint: any,
    options: any,
  ): Promise<EntryPointResult> {
    const queryResult = await this.queryAPI.query(params.projectPath, params.query, {
      outputStyle: entryPoint.outputStyle,
      model: options.model,
      mcpConfig: options.mcpConfig,
      timeout: options.timeout,
      filterThinking: options.filterThinking,
    });

    return {
      success: true,
      rawResult: queryResult.result,
      metadata: {
        entryPoint: params.entryPoint,
        duration: queryResult.metadata.durationMs,
        model: options.model || 'sonnet',
      },
    };
  }

  /**
   * 진입점 목록 조회
   */
  listEntryPoints(): string[] {
    return this.entryPointManager.listEntryPoints();
  }

  /**
   * 진입점 상세 조회
   */
  getEntryPointInfo(name: string) {
    return this.entryPointManager.getEntryPoint(name);
  }

  /**
   * 쿼리 API 인스턴스 반환 (Kill 등을 위해)
   */
  getQueryAPI(): ClaudeQueryAPI {
    return this.queryAPI;
  }
}
