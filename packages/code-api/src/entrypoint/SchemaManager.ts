/**
 * Schema Manager
 *
 * JSON 스키마 파일들을 관리하는 클래스
 * Convention: workflow/schemas/*.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SchemaDefinition } from './types';

export class SchemaManager {
  private schemasDir: string;
  private cachedSchemas: Map<string, SchemaDefinition> = new Map();

  constructor(projectPath: string) {
    this.schemasDir = path.join(projectPath, 'workflow', 'schemas');
    this.ensureSchemasDir();
  }

  /**
   * 스키마 디렉토리 생성
   */
  private ensureSchemasDir(): void {
    if (!fs.existsSync(this.schemasDir)) {
      fs.mkdirSync(this.schemasDir, { recursive: true });
    }
  }

  /**
   * 스키마 로드
   */
  loadSchema(schemaName: string): SchemaDefinition | null {
    // 캐시 확인
    if (this.cachedSchemas.has(schemaName)) {
      const cachedSchema = this.cachedSchemas.get(schemaName);
      if (cachedSchema) {
        return cachedSchema;
      }
    }

    const schemaPath = path.join(this.schemasDir, `${schemaName}.json`);

    if (!fs.existsSync(schemaPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(schemaPath, 'utf-8');
      const schema = JSON.parse(content) as SchemaDefinition;

      // 캐시에 저장
      this.cachedSchemas.set(schemaName, schema);

      return schema;
    } catch (error) {
      console.error(`Failed to load schema ${schemaName}:`, error);
      return null;
    }
  }

  /**
   * 스키마 저장
   */
  saveSchema(schema: SchemaDefinition): void {
    const schemaPath = path.join(this.schemasDir, `${schema.name}.json`);

    try {
      fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');

      // 캐시 업데이트
      this.cachedSchemas.set(schema.name, schema);

      console.log(`Schema saved: ${schema.name}`);
    } catch (error) {
      console.error(`Failed to save schema ${schema.name}:`, error);
      throw error;
    }
  }

  /**
   * 모든 스키마 목록 조회
   */
  listSchemas(): string[] {
    if (!fs.existsSync(this.schemasDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(this.schemasDir);
      return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
    } catch (error) {
      console.error('Failed to list schemas:', error);
      return [];
    }
  }

  /**
   * 스키마 삭제
   */
  deleteSchema(schemaName: string): boolean {
    const schemaPath = path.join(this.schemasDir, `${schemaName}.json`);

    if (!fs.existsSync(schemaPath)) {
      return false;
    }

    try {
      fs.unlinkSync(schemaPath);
      this.cachedSchemas.delete(schemaName);
      console.log(`Schema deleted: ${schemaName}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete schema ${schemaName}:`, error);
      return false;
    }
  }

  /**
   * 스키마 존재 여부 확인
   */
  schemaExists(schemaName: string): boolean {
    const schemaPath = path.join(this.schemasDir, `${schemaName}.json`);
    return fs.existsSync(schemaPath);
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cachedSchemas.clear();
  }

  /**
   * 스키마 디렉토리 경로 반환
   */
  getSchemasDir(): string {
    return this.schemasDir;
  }
}
