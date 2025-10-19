# Claude Code Skills Feature

## Overview

Skills 기능은 Claude Code의 능력을 확장하여 팀의 전문 지식과 워크플로우를 Claude에 학습시킬 수 있는 모듈형 시스템입니다. 이 플랫폼은 Skills를 생성, 관리, 공유할 수 있는 대화형 인터페이스를 제공합니다.

**Route:** `/skills` (예정)
**Component:** `src/pages/SkillsPage.tsx` (예정)

## What are Skills?

Skills는 Claude Code의 기능을 확장하는 모듈형 기능으로, 다음과 같은 특징이 있습니다:

- **모듈형 구조**: 각 Skill은 독립적인 폴더로 관리
- **자동 활성화**: Claude가 맥락에 따라 자동으로 관련 Skill 로드
- **팀 공유**: 프로젝트 또는 글로벌 레벨에서 Skill 공유 가능
- **커스터마이징**: 팀의 워크플로우에 맞춰 Skill 작성

## Skills Structure

### Basic Format

각 Skill은 `SKILL.md` 파일로 정의됩니다:

```markdown
---
name: skill-name
description: Brief description of what this skill does
---

# Skill Instructions

Detailed instructions for Claude on how to use this skill.

## Examples

Provide examples of when and how to use this skill.

## Guidelines

- Specific guidelines
- Best practices
- Constraints
```

### Directory Structure

**Global Skills** (모든 프로젝트에서 사용):
```
~/.claude/skills/
├── skill-name-1/
│   ├── SKILL.md
│   ├── templates/
│   └── examples/
└── skill-name-2/
    └── SKILL.md
```

**Project Skills** (특정 프로젝트에서만 사용):
```
project-root/
└── .claude/
    └── skills/
        ├── project-specific-skill-1/
        │   └── SKILL.md
        └── project-specific-skill-2/
            └── SKILL.md
```

## How Skills Work

### 1. Automatic Activation

Claude는 사용자의 요청을 분석하여 관련 Skill을 자동으로 선택합니다:
- **Model-invoked**: Claude가 자율적으로 Skill 사용 여부 결정
- **Context-aware**: 현재 작업 맥락에 가장 적합한 Skill 선택
- **Description-based**: Skill의 description을 기반으로 매칭

### 2. Skill Loading Priority

1. **Project Skills**: `.claude/skills/` (우선순위 높음)
2. **Global Skills**: `~/.claude/skills/` (우선순위 낮음)

동일한 이름의 Skill이 있을 경우 프로젝트 Skill이 우선합니다.

## Creating Skills

### Using the Skill Creator

공식 `skill-creator` Skill을 사용하면 대화형 방식으로 Skill을 생성할 수 있습니다:

1. Claude에게 새로운 Skill 생성 요청
2. Skill의 목적과 사용 사례 설명
3. Skill Creator가 자동으로 구조 생성
4. 필요한 파일과 템플릿 추가

### Manual Creation

직접 Skill을 생성할 수도 있습니다:

```bash
# 1. 디렉토리 생성
mkdir -p ~/.claude/skills/my-custom-skill

# 2. SKILL.md 파일 작성
cat > ~/.claude/skills/my-custom-skill/SKILL.md << 'EOF'
---
name: my-custom-skill
description: Custom workflow for my team
---

# My Custom Skill

Instructions for Claude...
EOF
```

## Example Skills

### Official Skills Repository

[anthropics/skills](https://github.com/anthropics/skills) 저장소에서 다양한 예제를 확인할 수 있습니다:

#### 1. **algorithmic-art**
프로그래밍 방식으로 예술 작품 생성

#### 2. **canvas-design**
디자인 작업 자동화

#### 3. **slack-gif-creator**
Slack용 GIF 생성

#### 4. **artifacts-builder**
재사용 가능한 아티팩트 구축

#### 5. **mcp-server**
MCP 서버 생성 및 관리

#### 6. **webapp-testing**
웹 애플리케이션 테스트 자동화

#### 7. **brand-guidelines**
브랜드 가이드라인 준수 확인

#### 8. **internal-comms**
내부 커뮤니케이션 템플릿

## Best Practices

### 1. Clear Descriptions

Skill의 description은 Claude가 언제 사용할지 결정하는 중요한 요소입니다:

```yaml
# Good
description: Generate API documentation from TypeScript code with JSDoc comments

# Bad
description: Documentation tool
```

### 2. Specific Instructions

구체적이고 명확한 지침을 제공하세요:

```markdown
## When to Use

Use this skill when:
- User asks to document an API
- TypeScript files with JSDoc comments are present
- Output format should be Markdown

## How to Use

1. Scan for TypeScript files with exported functions
2. Extract JSDoc comments
3. Generate Markdown documentation
4. Include code examples
```

### 3. Include Examples

실제 사용 예제를 포함하세요:

```markdown
## Example Usage

Input:
```typescript
/**
 * Calculates the sum of two numbers
 * @param a First number
 * @param b Second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

Output:
```markdown
### add(a, b)

Calculates the sum of two numbers.

**Parameters:**
- `a` (number): First number
- `b` (number): Second number

**Returns:** (number) The sum of a and b
```
```

### 4. Version Control

Skills를 git으로 관리하여 팀과 공유하세요:

```bash
# .claude/skills/를 git에 포함
git add .claude/skills/
git commit -m "Add custom workflow skill"
git push
```

## Interactive Skills Management UI (Planned)

### Features

1. **Skill Browser**
   - 프로젝트 및 글로벌 Skill 목록 조회
   - Skill 검색 및 필터링
   - Skill 미리보기

2. **Skill Editor**
   - YAML frontmatter 편집
   - Markdown 본문 편집
   - 실시간 미리보기
   - 문법 검증

3. **Skill Creator Wizard**
   - 단계별 Skill 생성 가이드
   - 템플릿 선택
   - 예제 코드 자동 생성

4. **Bidirectional Sync**
   - UI에서 편집 → SKILL.md 파일 업데이트
   - SKILL.md 파일 변경 → UI 자동 반영
   - 변경 사항 추적

5. **Skill Testing**
   - Skill 테스트 실행
   - 예상 동작 검증
   - 결과 확인

## Data Models

### Skill Interface

```typescript
interface Skill {
  // Metadata
  id: string;                    // Unique identifier (folder name)
  name: string;                  // Skill name from frontmatter
  description: string;           // Brief description
  scope: 'global' | 'project';   // Installation scope
  path: string;                  // Absolute path to skill directory

  // Content
  frontmatter: {
    name: string;
    description: string;
    [key: string]: any;          // Additional frontmatter fields
  };
  content: string;               // Markdown content

  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  author?: string;
  version?: string;

  // Supporting files
  files?: SkillFile[];
}

interface SkillFile {
  path: string;                  // Relative to skill directory
  name: string;
  type: 'template' | 'example' | 'script' | 'other';
  content?: string;
}
```

### Skill Manager Service

```typescript
class SkillManager {
  // CRUD operations
  async listSkills(scope?: 'global' | 'project'): Promise<Skill[]>
  async getSkill(id: string): Promise<Skill | null>
  async createSkill(skill: Partial<Skill>): Promise<Skill>
  async updateSkill(id: string, updates: Partial<Skill>): Promise<Skill>
  async deleteSkill(id: string): Promise<void>

  // Utility methods
  async scanSkills(): Promise<{ global: Skill[], project: Skill[] }>
  async validateSkill(skill: Partial<Skill>): Promise<ValidationResult>
  async exportSkill(id: string, destinationPath: string): Promise<void>
  async importSkill(sourcePath: string, scope: 'global' | 'project'): Promise<Skill>
}
```

## IPC Channels

### Skill Management

- `skill:list` - List all skills
- `skill:get` - Get skill by ID
- `skill:create` - Create new skill
- `skill:update` - Update existing skill
- `skill:delete` - Delete skill
- `skill:scan` - Scan for skills in filesystem
- `skill:validate` - Validate skill structure
- `skill:export` - Export skill to file
- `skill:import` - Import skill from file

### File Operations

- `skill:readFile` - Read skill file content
- `skill:writeFile` - Write skill file content
- `skill:listFiles` - List files in skill directory

## UI Components

### SkillsPage

메인 페이지:
- Skills 목록 표시 (Global/Project 탭)
- 검색 및 필터링
- 새 Skill 생성 버튼
- Skill 선택 시 상세 뷰로 이동

### SkillEditor

Skill 편집 컴포넌트:
- **Split View**:
  - 좌측: YAML + Markdown 에디터
  - 우측: 실시간 미리보기
- **Toolbar**:
  - Save, Cancel, Delete
  - Template insertion
  - Validation

### SkillCreatorWizard

Skill 생성 마법사:
1. **Basic Info**: Name, Description
2. **Type Selection**: 템플릿 선택
3. **Instructions**: 주요 지침 작성
4. **Examples**: 예제 추가
5. **Review**: 최종 검토 및 생성

## Implementation Plan

### Phase 1: Documentation & Data Models
- [x] Skills 개요 문서 작성
- [ ] 상세 사용 가이드 작성
- [ ] 데이터 모델 정의
- [ ] TypeScript 인터페이스 작성

### Phase 2: Backend Infrastructure
- [ ] SkillManager 서비스 구현
- [ ] IPC 핸들러 구현
- [ ] 파일 시스템 연동
- [ ] 유효성 검증 로직

### Phase 3: UI Components
- [ ] SkillsPage 컴포넌트
- [ ] SkillEditor 컴포넌트
- [ ] SkillCreatorWizard 컴포넌트
- [ ] 공통 컴포넌트 (SkillCard, SkillList 등)

### Phase 4: Bidirectional Sync
- [ ] 파일 변경 감지
- [ ] UI → 파일 동기화
- [ ] 파일 → UI 동기화
- [ ] 충돌 해결 로직

### Phase 5: Testing & Polish
- [ ] 단위 테스트
- [ ] 통합 테스트
- [ ] UI/UX 개선
- [ ] 문서 업데이트

## Related Documentation

- [Claude Code Overview](https://docs.claude.com/en/docs/claude-code/overview)
- [Official Skills Repository](https://github.com/anthropics/skills)
- [Skills Specification](https://github.com/anthropics/skills/blob/main/agent_skills_spec.md)
- [Agent System](../agents/index.md)
- [Memory Management](../memory/index.md)

## Resources

### Official Links
- [Skills Documentation](https://docs.claude.com/en/docs/claude-code/skills)
- [Skills GitHub Repository](https://github.com/anthropics/skills)
- [Creating Skills Tutorial](https://support.claude.com/en/articles/12580051-teach-claude-your-way-of-working-using-skills)

### Community Resources
- [Claude Skills Discussion](https://simonwillison.net/2025/Oct/16/claude-skills/)
- [Skills Examples](https://github.com/anthropics/claude-cookbooks/tree/main/skills)
