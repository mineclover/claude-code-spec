# Context Reference Guide

## Context Reference Guidelines

### Preventing Accidental Context Inclusion
When writing documentation or examples that mention `@` references, use backticks to prevent AI from interpreting them as active context:

**Correct:**
```markdown
Use `@context/sub-agent/tools-available-to-claude.md` to reference tool information
```

**Incorrect:**
```markdown
Use @context/sub-agent/tools-available-to-claude.md to reference tool information
```

The backticks ensure the `@reference` is treated as literal text, not an active context inclusion.

### Path Structure
All `@` references are relative to the project root:
- Format: `@context/{topic}/{filename}.md`
- Example: `@context/memory/context-reference-guide.md`

### Best Practices
- Name memory files descriptively
- Keep memory files focused on specific topics
- Update memory files as project context evolves
- Use `@` references only when context is actually needed

## Writing Format Guidelines (Base)

These guidelines serve as the base format for all context/ documentation:

### 1. Structure
- Start with clear Overview section
- Include Key Concepts for quick understanding
- Use modular document references with `@` syntax (without backticks for actual imports)
- No external reference links in index.md (references go in reference.md only)

### 2. Content Quality
- Curate and refine information directly
- Trust in well-organized, focused content over many references
- Keep information actionable and practical

### 3. Modularity
- Break down complex topics into separate .md files
- Reference them using `@context/{topic}/{filename}.md` pattern (no backticks for actual imports)
- Each module should be self-contained and focused
- Index files contain only headlines and module references

### 4. Reference vs Import
- **Import (actual reference)**: `@context/memory/guide.md` - Claude will load this content
- **Documentation (mention only)**: Use backticks like `@context/memory/guide.md` to prevent loading

## Reference Format Examples

### Example 1: Well-Structured index.md

```markdown
# Usage

## Overview
Claude Code CLI command patterns and request formats. Practical guide for effective CLI usage and prompt structure.

## Topics

### CLI Reference
@context/usage/cli-reference.md

Command-line interface commands, flags, and options.

### Common Workflows
@context/usage/common-workflows.md

Development workflows, integration patterns, and productivity techniques.

### Slash Commands
@context/usage/slash-commands.md

Built-in and custom slash commands for CLI shortcuts.

### Effective Queries
@context/usage/effective-queries.md

Query patterns, best practices, and optimization techniques for Claude Code.
```

**Key Features:**
- Brief Overview without external links
- Topics section with `@` imports (no backticks)
- One-line description below each import
- No external reference links (those go in `reference.md`)

### Example 2: Monitoring Usage Structure

```markdown
# Monitoring Usage

## Overview
OpenTelemetry integration for tracking Claude Code usage metrics and telemetry.

## Topics

### OpenTelemetry Setup
@context/monitoring-usage/opentelemetry-setup.md

Configuration methods, environment variables, collection triggers, and metrics captured.

### Platform Integrations
@context/monitoring-usage/otel-integrations.md

Integration configurations for Datadog, New Relic, Honeycomb, Grafana Cloud, and custom collectors.
```

### Example 3: Memory System Structure

```markdown
# Memory

## Overview
Claude Code uses CLAUDE.md files to persist instructions and context across sessions. Memory operates hierarchically across enterprise, project, and user levels.

## Topics

### Memory Hierarchy
@context/memory/memory-hierarchy.md

Enterprise → Project → User precedence order.

### Memory Features
@context/memory/memory-features.md

`@path` imports with 5-hop recursion limit.

### Writing Guidelines
@context/memory/context-reference-guide.md

Reference patterns and modular documentation format.
```

### Example 4: reference.md Pattern

```markdown
# Monitoring Usage Reference

## Official Documentation
- [Monitoring Usage](https://docs.claude.com/en/docs/claude-code/monitoring-usage) - OpenTelemetry integration and usage tracking

## Related Context
- `@context/config/settings-hierarchy.md` - Settings precedence and merging behavior
- `@context/config/settings-features.md` - Available settings and configuration options
```

**Key Features:**
- External links with descriptions
- Related context using backticks (documentation only, not imports)
- Clear categorization

## Common Patterns

### Pattern 1: Index File Structure
```markdown
# [Topic Name]

## Overview
[Brief description without external links]

## Topics

### [Subtopic 1]
@context/[topic]/[file].md

[One-line description]

### [Subtopic 2]
@context/[topic]/[file].md

[One-line description]
```

### Pattern 2: Reference File Structure
```markdown
# [Topic Name] Reference

## Official Documentation
- [Link Text](url) - Description

## Related Context
- `@context/path/file.md` - Description
```

### Pattern 3: Content File Structure
```markdown
# [Topic Name]

## [Section 1]
[Content without external links]

## [Section 2]
[Content without external links]

### [Subsection]
[Detailed content]
```

**Remember:**
- `index.md`: Context hub with `@` imports (no backticks)
- `reference.md`: External links and related context references (with backticks)
- Content files: Pure content, no external links