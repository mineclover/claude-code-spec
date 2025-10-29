# Claude.md Guidelines Collection

Based on [Claude 4.5 Best Practices](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices)

## Available Guidelines

### 1. Anti-Hallucination Guidelines
**File**: `anti-hallucination.md`
**Category**: Code Work
**Use when**: Working with existing code, answering questions about code

**Core principle**: Never speculate about code you have not opened. Always investigate first.

### 2. Coding Best Practices
**File**: `coding-best-practices.md`
**Category**: Code Work
**Use when**: Writing or modifying code

**Key points**:
- Use explicit action instructions
- Write general-purpose solutions
- Track state across sessions
- Focus on understanding requirements

### 3. Analysis & Research Mode
**File**: `analysis-mode.md`
**Category**: Analysis
**Use when**: Understanding codebases, researching implementations

**Key points**:
- Read before conclusions
- Document findings with evidence
- Hierarchical exploration
- Structured output format

### 4. General-Purpose Solutions
**File**: `general-purpose-solutions.md`
**Category**: Code Work
**Use when**: Implementing algorithms, solving problems

**Core principle**: Write solutions that work for all valid inputs, not just test cases.

## How to Use

### Option 1: Add to Global CLAUDE.md
Copy relevant sections to `~/.claude/CLAUDE.md` for all projects.

### Option 2: Add to Project CLAUDE.md
Copy relevant sections to project's `CLAUDE.md` for project-specific use.

### Option 3: Reference in Context
Include as reference documents and reference in tasks or agents.

### Option 4: Combine Multiple Guidelines
Create custom combinations for specific workflows:

```markdown
<!-- In your CLAUDE.md -->

# Coding Work Guidelines
@guidelines/anti-hallucination.md
@guidelines/coding-best-practices.md
@guidelines/general-purpose-solutions.md
```

## Recommended Combinations

### For Code Implementation Tasks
- `anti-hallucination.md` - Ensure accurate understanding
- `coding-best-practices.md` - Follow best practices
- `general-purpose-solutions.md` - Write quality code

### For Code Analysis Tasks
- `anti-hallucination.md` - Accurate code understanding
- `analysis-mode.md` - Structured exploration

### For All Tasks
- `coding-best-practices.md` - General quality standards

## Customization

Feel free to:
- Modify guidelines to fit your project needs
- Create new guidelines based on your experience
- Combine multiple guidelines into custom presets
- Add project-specific examples

## Source

These guidelines are based on official Anthropic documentation:
https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices
