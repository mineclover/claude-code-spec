# System Prompt vs Output Style

Entry Point 시스템에서 두 가지 독립적인 제어 메커니즘을 제공합니다.

## 핵심 차이점

| 구분 | Output Style | System Prompt |
|------|--------------|---------------|
| **목적** | **응답 형식** 제어 | **AI 역할/행동** 제어 |
| **제어 대상** | 구조, 톤, 출력 스타일 | 도메인 지식, 지침, 페르소나 |
| **설정 위치** | `.claude/output-styles/*.md` | Entry Point 설정 내 |
| **예시** | "JSON으로 응답", "간결하게" | "당신은 SRE 전문가", "보안 우선" |

## Output Style

**응답의 형식과 구조를 정의**

```markdown
<!-- .claude/output-styles/structured-json.md -->
---
name: Structured JSON
description: Always respond with valid JSON
---

You must respond with valid JSON only.
Do not include markdown code blocks.
```

**언제 사용?**
- JSON, YAML, Markdown 등 특정 형식 강제
- 응답 톤 조정 (formal, casual, technical)
- 출력 구조 표준화

## System Prompt

**AI의 역할, 도메인 지식, 행동 지침을 정의**

```typescript
const entryPoint: EntryPointConfig = {
  name: 'sre-incident',
  systemPrompt: {
    custom: `You are an expert SRE with 10 years experience.

    When investigating incidents:
    - Start with service health checks
    - Check recent deployments
    - Review error logs systematically
    - Prioritize customer impact
    - Document findings clearly`
  }
}
```

**언제 사용?**
- 전문 도메인 지식 주입 (SRE, Security, Legal)
- 특정 역할 부여 (코드 리뷰어, 아키텍트, 테스터)
- 행동 지침 정의 (보수적 vs 적극적)
- 프로젝트별 컨벤션 강제

## 조합 사용

**두 가지를 함께 사용하여 강력한 실행 컨텍스트 생성**

```typescript
const entryPoint: EntryPointConfig = {
  name: 'security-review',
  description: '보안 중심 코드 리뷰',

  // 1️⃣ 출력 형식 제어
  outputStyle: 'structured-json',
  outputFormat: {
    type: 'structured',
    schemaName: 'security-review'
  },

  // 2️⃣ AI 역할 정의
  systemPrompt: {
    useClaudeCodePreset: true,
    append: `You are a security auditor.

    Focus areas:
    - Input validation
    - SQL injection risks
    - XSS vulnerabilities
    - Authentication/Authorization
    - Sensitive data exposure

    Always assume adversarial input.`
  }
}
```

**결과:**
- ✅ 정확한 스키마 검증된 JSON 출력 (Output Style)
- ✅ 보안 전문가 관점의 심층 분석 (System Prompt)

## 사용 패턴

### 패턴 1: Output Style만 사용
```typescript
{
  name: 'quick-json',
  outputFormat: { type: 'json' },
  outputStyle: 'concise'
  // systemPrompt 없음 → 기본 Claude 행동
}
```
**용도**: 간단한 데이터 추출, 일반적인 질문

### 패턴 2: System Prompt만 사용
```typescript
{
  name: 'brainstorm',
  outputFormat: { type: 'text' },
  systemPrompt: {
    custom: 'You are a creative product manager...'
  }
  // outputStyle 없음 → 자유로운 형식
}
```
**용도**: 브레인스토밍, 창의적 작업

### 패턴 3: 둘 다 사용 (권장)
```typescript
{
  name: 'code-review',
  outputFormat: { type: 'structured', schemaName: 'review' },
  outputStyle: 'code-reviewer',
  systemPrompt: {
    useClaudeCodePreset: true,
    append: 'Focus on performance and scalability'
  }
}
```
**용도**: 전문적이고 구조화된 작업

## System Prompt 옵션

### 1. Custom (완전 교체)
```typescript
systemPrompt: {
  custom: 'You are a Python specialist. Always use type hints.'
}
```
- 기본 시스템 프롬프트 **완전 대체**
- 전문화된 Agent 생성 시

### 2. Append (추가)
```typescript
systemPrompt: {
  append: 'Always include comprehensive error handling.'
}
```
- 기본 프롬프트에 **추가**
- 특정 요구사항 주입 시

### 3. Preset + Append (권장)
```typescript
systemPrompt: {
  useClaudeCodePreset: true,
  append: 'Prioritize OAuth 2.0 compliance'
}
```
- Claude Code 기본 동작 유지
- 프로젝트별 지침 추가

## 실전 예제

### SRE 인시던트 대응
```typescript
{
  name: 'sre-incident',
  outputFormat: {
    type: 'structured',
    schemaName: 'incident-report'
  },
  systemPrompt: {
    custom: `You are an experienced SRE.

    Investigation process:
    1. Identify symptoms
    2. Check recent changes
    3. Review logs
    4. Propose fixes
    5. Document learnings

    Always prioritize service restoration over root cause.`
  }
}
```

### 법률 문서 리뷰
```typescript
{
  name: 'legal-review',
  outputFormat: {
    type: 'structured',
    schemaName: 'legal-analysis'
  },
  systemPrompt: {
    custom: `You are a legal analyst specializing in software licenses.

    Review for:
    - License compatibility
    - Liability clauses
    - Compliance requirements
    - Risk assessment

    Use precise legal terminology.`
  }
}
```

### 코드 리팩토링
```typescript
{
  name: 'refactor',
  outputFormat: { type: 'text' },
  systemPrompt: {
    useClaudeCodePreset: true,
    append: `Refactoring principles:
    - Keep changes minimal
    - Preserve behavior
    - Add tests first
    - Document why, not what
    - Consider performance impact`
  }
}
```

## 요약

| 제어 목표 | 사용할 것 |
|-----------|----------|
| 응답을 JSON으로 | Output Style |
| AI를 보안 전문가로 | System Prompt |
| 응답을 간결하게 | Output Style |
| 특정 도메인 지식 주입 | System Prompt |
| 출력 구조 표준화 | Output Style |
| 행동 지침 정의 | System Prompt |
| **둘 다 필요** | **둘 다 사용** ✅ |

**핵심**: Output Style과 System Prompt는 **독립적이고 보완적**입니다. 함께 사용하여 강력하고 예측 가능한 실행 컨텍스트를 만드세요.
