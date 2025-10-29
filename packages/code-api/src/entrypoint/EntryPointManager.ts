/**
 * Entry Point Manager
 *
 * 진입점 설정 파일을 관리하는 클래스
 * Convention: workflow/entry-points.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EntryPointConfig, EntryPointsConfig, ValidationResult } from './types';
import { SchemaManager } from './SchemaManager';

export class EntryPointManager {
  private configPath: string;
  private projectPath: string;
  private cachedConfig: EntryPointsConfig | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, 'workflow', 'entry-points.json');
    this.ensureConfigFile();
  }

  /**
   * 설정 파일 초기화
   */
  private ensureConfigFile(): void {
    const workflowDir = path.dirname(this.configPath);

    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    }

    if (!fs.existsSync(this.configPath)) {
      const defaultConfig: EntryPointsConfig = {
        version: '1.0.0',
        entryPoints: {},
      };

      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    }
  }

  /**
   * 설정 로드
   */
  private loadConfig(): EntryPointsConfig {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      this.cachedConfig = JSON.parse(content) as EntryPointsConfig;
      return this.cachedConfig;
    } catch (error) {
      console.error('Failed to load entry points config:', error);
      return { version: '1.0.0', entryPoints: {} };
    }
  }

  /**
   * 설정 저장
   */
  private saveConfig(config: EntryPointsConfig): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.cachedConfig = config;
    } catch (error) {
      console.error('Failed to save entry points config:', error);
      throw error;
    }
  }

  /**
   * 진입점 추가/업데이트
   */
  setEntryPoint(config: EntryPointConfig): void {
    // 검증 수행
    const validation = this.validateEntryPoint(config);

    if (!validation.valid) {
      const errorMessage = `Entry point validation failed:\n${validation.errors.join('\n')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (validation.warnings.length > 0) {
      console.warn('Entry point validation warnings:');
      validation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    const allConfig = this.loadConfig();

    allConfig.entryPoints[config.name] = config;

    this.saveConfig(allConfig);
    console.log(`Entry point saved: ${config.name}`);
  }

  /**
   * 진입점 조회
   */
  getEntryPoint(name: string): EntryPointConfig | null {
    const config = this.loadConfig();
    return config.entryPoints[name] || null;
  }

  /**
   * 모든 진입점 조회
   */
  getAllEntryPoints(): Record<string, EntryPointConfig> {
    const config = this.loadConfig();
    return config.entryPoints;
  }

  /**
   * 진입점 목록 조회
   */
  listEntryPoints(): string[] {
    const config = this.loadConfig();
    return Object.keys(config.entryPoints);
  }

  /**
   * 진입점 삭제
   */
  deleteEntryPoint(name: string): boolean {
    const config = this.loadConfig();

    if (!config.entryPoints[name]) {
      return false;
    }

    delete config.entryPoints[name];
    this.saveConfig(config);

    console.log(`Entry point deleted: ${name}`);
    return true;
  }

  /**
   * 진입점 존재 여부 확인
   */
  entryPointExists(name: string): boolean {
    const config = this.loadConfig();
    return !!config.entryPoints[name];
  }

  /**
   * 진입점 검증
   */
  validateEntryPoint(config: EntryPointConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 필수 필드 검증
    if (!config.name || config.name.trim() === '') {
      errors.push('Entry point name is required');
    }

    if (!config.description || config.description.trim() === '') {
      errors.push('Entry point description is required');
    }

    if (!config.outputFormat) {
      errors.push('Output format is required');
    }

    // 출력 형식 검증
    if (config.outputFormat) {
      if (!['text', 'json', 'structured'].includes(config.outputFormat.type)) {
        errors.push('Invalid output format type');
      }

      if (config.outputFormat.type === 'structured' && !config.outputFormat.schema && !config.outputFormat.schemaName) {
        errors.push('Schema is required for structured output');
      }

      // structured 타입일 때 스키마 존재 여부 확인
      if (config.outputFormat.type === 'structured') {
        const schemaName = config.outputFormat.schemaName || config.outputFormat.schema?.replace('.json', '');
        if (schemaName) {
          const schemaManager = new SchemaManager(this.projectPath);
          if (!schemaManager.schemaExists(schemaName)) {
            errors.push(`Schema '${schemaName}' does not exist in workflow/schemas/. Please create it first using SchemaManager.`);
          }
        }
      }
    }

    // 옵션 검증
    if (config.options) {
      if (config.options.model && !['sonnet', 'opus', 'haiku'].includes(config.options.model)) {
        errors.push('Invalid model name');
      }

      if (config.options.timeout && config.options.timeout < 1000) {
        warnings.push('Timeout should be at least 1000ms');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 태그로 진입점 필터링
   */
  filterByTag(tag: string): EntryPointConfig[] {
    const config = this.loadConfig();
    return Object.values(config.entryPoints).filter((ep) => ep.tags?.includes(tag));
  }

  /**
   * 진입점 검색
   */
  searchEntryPoints(query: string): EntryPointConfig[] {
    const config = this.loadConfig();
    const lowerQuery = query.toLowerCase();

    return Object.values(config.entryPoints).filter(
      (ep) =>
        ep.name.toLowerCase().includes(lowerQuery) ||
        ep.description.toLowerCase().includes(lowerQuery) ||
        ep.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cachedConfig = null;
  }

  /**
   * 설정 파일 경로 반환
   */
  getConfigPath(): string {
    return this.configPath;
  }
}
