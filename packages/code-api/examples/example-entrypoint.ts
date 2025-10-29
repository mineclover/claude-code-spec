#!/usr/bin/env tsx
/**
 * Entry Point System Example
 *
 * 진입점 시스템을 사용한 구조화된 쿼리 실행 예제
 */

import {
  type EntryPointConfig,
  EntryPointExecutor,
  EntryPointManager,
  type SchemaDefinition,
  SchemaManager,
} from '../src/entrypoint';

async function main() {
  const projectPath = process.cwd();

  console.log('==================================================');
  console.log('Entry Point System Example');
  console.log('==================================================\n');

  // ========================================
  // Step 1: 스키마 관리
  // ========================================
  console.log('--- Step 1: Schema Management ---\n');
  console.log('⚠️  Schemas will be saved to: workflow/schemas/*.json\n');

  const schemaManager = new SchemaManager(projectPath);

  // 코드 리뷰 스키마 생성
  const codeReviewSchema: SchemaDefinition = {
    name: 'code-review',
    description: '코드 리뷰 및 품질 분석 결과',
    schema: {
      file: {
        type: 'string',
        description: '분석한 파일 경로',
        required: true,
      },
      score: {
        type: 'number',
        description: '전체 품질 점수',
        min: 1,
        max: 10,
        required: true,
      },
      complexity: {
        type: 'number',
        description: '순환 복잡도',
        min: 1,
        max: 50,
        required: true,
      },
      issues: {
        type: 'array',
        arrayItemType: 'object',
        description: '발견된 이슈 목록',
        required: true,
      },
      suggestions: {
        type: 'array',
        arrayItemType: 'string',
        description: '개선 제안',
        required: true,
      },
    },
    examples: [
      {
        file: 'src/utils/helper.ts',
        score: 7,
        complexity: 12,
        issues: [
          {
            line: 45,
            severity: 'warning',
            message: '함수가 너무 깁니다',
          },
        ],
        suggestions: ['함수 분리를 고려하세요', '타입 정의를 추가하세요'],
      },
    ],
  };

  schemaManager.saveSchema(codeReviewSchema);
  console.log('✅ Schema saved: code-review');

  // 저장된 스키마 목록 조회
  const schemas = schemaManager.listSchemas();
  console.log(`\nAvailable schemas: ${schemas.join(', ')}\n`);

  // ========================================
  // Step 2: 진입점 설정
  // ========================================
  console.log('--- Step 2: Entry Point Configuration ---\n');
  console.log('⚠️  Entry points will be saved to: workflow/entry-points.json\n');
  console.log('🔍 Schema validation enabled: System will check if schemas exist before saving\n');

  const entryPointManager = new EntryPointManager(projectPath);

  // 코드 리뷰 진입점 생성
  const codeReviewEntry: EntryPointConfig = {
    name: 'code-review',
    description: '코드 파일을 분석하여 품질, 복잡도, 개선사항을 평가합니다',
    outputStyle: 'structured-json',
    outputFormat: {
      type: 'structured',
      schemaName: 'code-review',
    },
    options: {
      model: 'sonnet',
      timeout: 120000,
      filterThinking: true,
    },
    examples: ['Analyze src/main.ts for code quality', 'Review src/components/Header.tsx'],
    tags: ['code-quality', 'analysis', 'structured'],
  };

  entryPointManager.setEntryPoint(codeReviewEntry);
  console.log('✅ Entry point saved: code-review (schema validated)\n');

  // Schema validation 테스트 (실패 케이스)
  console.log('Testing schema validation with non-existent schema...');
  try {
    const invalidEntry: EntryPointConfig = {
      name: 'invalid-test',
      description: 'Test entry with non-existent schema',
      outputFormat: {
        type: 'structured',
        schemaName: 'non-existent-schema',
      },
    };
    entryPointManager.setEntryPoint(invalidEntry);
  } catch (error) {
    console.log('❌ Validation failed as expected:', (error as Error).message.split('\n')[0]);
    console.log('   This prevents runtime errors!\n');
  }

  // Quick JSON 진입점 생성 (스키마 없음)
  const quickJsonEntry: EntryPointConfig = {
    name: 'quick-json',
    description: '간단한 JSON 형식 쿼리 (스키마 없음)',
    outputFormat: {
      type: 'json',
    },
    options: {
      model: 'sonnet',
      timeout: 60000,
      filterThinking: true,
    },
    examples: ['List all TypeScript files', 'Count lines of code'],
    tags: ['quick', 'json', 'utility'],
  };

  entryPointManager.setEntryPoint(quickJsonEntry);
  console.log('✅ Entry point saved: quick-json');

  // 진입점 목록 조회
  const entryPoints = entryPointManager.listEntryPoints();
  console.log(`\nAvailable entry points: ${entryPoints.join(', ')}\n`);

  // ========================================
  // Step 2-1: 진입점 상세 정보 조회 (핵심 기능!)
  // ========================================
  console.log('--- Step 2-1: 실행 전 기댓값 확인 ---\n');
  console.log('💡 실행자는 실행 전에 어떤 출력을 받을지 명확히 알 수 있어야 합니다!\n');

  const codeReviewDetail = entryPointManager.getEntryPointDetail('code-review');

  if (codeReviewDetail) {
    console.log('📋 진입점: code-review');
    console.log(`   설명: ${codeReviewDetail.config.description}`);
    console.log(`\n📤 예상 출력:`);
    console.log(`   타입: ${codeReviewDetail.expectedOutput.type}`);
    console.log(`   설명: ${codeReviewDetail.expectedOutput.description}`);

    if (codeReviewDetail.expectedOutput.fields) {
      console.log(`\n📝 출력 필드:`);
      Object.entries(codeReviewDetail.expectedOutput.fields).forEach(
        ([key, value]: [string, any]) => {
          const required = value.required ? '(필수)' : '(선택)';
          console.log(`   - ${key}: ${value.type} ${required} - ${value.description}`);
        },
      );
    }

    if (codeReviewDetail.schema?.examples && codeReviewDetail.schema.examples.length > 0) {
      console.log(`\n💡 출력 예시:`);
      console.log(JSON.stringify(codeReviewDetail.schema.examples[0], null, 2));
    }
  }

  console.log('\n✅ 이제 실행자는 정확히 어떤 형식의 데이터를 받을지 알 수 있습니다!\n');

  // ========================================
  // Step 3: 진입점을 통한 쿼리 실행
  // ========================================
  console.log('--- Step 3: Execute via Entry Point ---\n');

  const executor = new EntryPointExecutor(projectPath);

  // Example 3-1: Code Review 진입점 사용
  console.log('\n📝 Example 3-1: Code Review\n');

  try {
    const result = await executor.execute({
      entryPoint: 'code-review',
      projectPath,
      query: 'Analyze packages/code-api/src/entrypoint/types.ts for code quality',
    });

    if (result.success) {
      console.log('✅ Analysis completed!');
      console.log('\nResult:');
      console.log(JSON.stringify(result.data, null, 2));
      console.log(`\nDuration: ${result.metadata.duration}ms`);
      console.log(`Model: ${result.metadata.model}`);
    } else {
      console.error('❌ Analysis failed:', result.error);
    }
  } catch (error) {
    console.error('Error during execution:', error);
  }

  // Example 3-2: Quick JSON 진입점 사용
  console.log('\n\n📝 Example 3-2: Quick JSON Query\n');

  try {
    const result = await executor.execute({
      entryPoint: 'quick-json',
      projectPath,
      query: 'List all .ts files in packages/code-api/src/entrypoint/ directory',
    });

    if (result.success) {
      console.log('✅ Query completed!');
      console.log('\nResult:');
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.error('❌ Query failed:', result.error);
    }
  } catch (error) {
    console.error('Error during execution:', error);
  }

  // ========================================
  // Step 4: 진입점 검색 및 필터링
  // ========================================
  console.log('\n--- Step 4: Search and Filter ---\n');

  const structuredEntries = entryPointManager.filterByTag('structured');
  console.log(`\nStructured entry points: ${structuredEntries.map((e) => e.name).join(', ')}`);

  const searchResults = entryPointManager.searchEntryPoints('code');
  console.log(`\nSearch results for "code": ${searchResults.map((e) => e.name).join(', ')}`);

  console.log('\n==================================================');
  console.log('Example Complete!');
  console.log('==================================================');
}

main().catch(console.error);
