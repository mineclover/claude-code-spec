# Sub-Agent Design

## Design Principles

### 1. Single Responsibility
Each agent should have one clear, focused purpose.

**Good:**
```yaml
name: test-generator
description: Generates unit tests for TypeScript code
```

**Avoid:**
```yaml
name: code-helper
description: Does testing, documentation, and refactoring
```

### 2. Clear Success Criteria
Define measurable outcomes in the agent prompt.

```markdown
## Success Criteria
- All public functions have tests
- Test coverage > 80%
- Tests follow AAA pattern (Arrange, Act, Assert)
```

### 3. Explicit Tool Usage
Document which tools to use and when.

```markdown
## Tool Usage
1. Use Read to examine source files
2. Use Grep to find related test files
3. Use Write to create new test files
4. Never use Bash for file operations
```

### 4. Context-Appropriate Memory
Import only relevant context using `@path/to/context`.

```markdown
## Project Context
@.claude/CLAUDE.md
@context/testing/standards.md

Use these standards when generating tests.
```

## Best Practices

### Agent Scope

**Narrow and Deep**
```yaml
name: api-documenter
description: Generates OpenAPI documentation from Express routes
allowedTools: [Read, Write, Grep]
```

**Not Broad and Shallow**
```yaml
name: full-stack-helper
description: Helps with frontend, backend, and database
allowedTools: [Bash, Read, Write, Edit, Grep]
```

### Tool Restrictions

Limit tools to minimum necessary:

```yaml
# Read-only analysis agent
allowedTools: [Read, Grep]

# Documentation agent
allowedTools: [Read, Write]

# Refactoring agent
allowedTools: [Read, Edit, Grep]
```

### Permission Patterns

Use glob patterns for fine-grained control:

```yaml
permissions:
  allowList:
    - "read:**"                    # Read anything
    - "write:docs/**"              # Write only to docs
    - "write:tests/**/*.test.ts"   # Write test files only
  denyList:
    - "write:src/core/**"          # Never modify core
    - "read:**/*.env"              # Never read env files
```

### Prompt Structure

#### Clear Role Definition
```markdown
# Role
You are an expert TypeScript refactoring specialist focused on improving code maintainability without changing behavior.
```

#### Structured Instructions
```markdown
## Process
1. Analyze code structure
2. Identify refactoring opportunities
3. Propose changes with rationale
4. Apply approved changes

## Focus Areas
- Extract complex functions
- Reduce duplication
- Improve naming
- Simplify conditionals
```

#### Constraints and Boundaries
```markdown
## Constraints
- Never change public APIs
- Preserve all existing tests
- Maintain current behavior
- Document all changes
```

#### Expected Outputs
```markdown
## Output Format
**Refactoring Summary**
- Files modified: [list]
- Changes made: [description]
- Test status: [pass/fail]

**Rationale**
[Explain why each change improves the code]
```

## Example Agents

### Test Generator
```yaml
---
name: test-generator
description: Generates comprehensive unit tests
allowedTools: [Read, Write, Grep]
---

# Test Generator Agent

Generate unit tests following project testing standards.

## Process
1. Read source file
2. Identify public functions
3. Generate test cases
4. Follow AAA pattern

## Context
@context/testing/standards.md
```

### Documentation Writer
```yaml
---
name: doc-writer
description: Creates and updates technical documentation
allowedTools: [Read, Write, Grep]
permissions:
  allowList:
    - "read:src/**"
    - "write:docs/**"
---

# Documentation Writer

Create clear, comprehensive technical documentation.

## Standards
- Use active voice
- Include code examples
- Add diagrams where helpful
- Keep under 500 words per section
```

### Security Reviewer
```yaml
---
name: security-reviewer
description: Reviews code for security vulnerabilities
allowedTools: [Read, Grep]
---

# Security Reviewer

Analyze code for security issues.

## Review Checklist
- Input validation
- Authentication/authorization
- SQL injection risks
- XSS vulnerabilities
- Sensitive data exposure
```

## Testing Agents

### Local Testing
```bash
# Test agent with sample input
claude --agent test-generator "Generate tests for src/auth.ts"
```

### Iteration
1. Create initial agent
2. Test with representative tasks
3. Refine based on results
4. Adjust tool permissions
5. Update instructions

### Validation
- Test edge cases
- Verify tool restrictions work
- Check output quality
- Ensure consistent behavior