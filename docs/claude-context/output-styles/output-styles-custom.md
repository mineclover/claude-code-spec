# Custom Output Styles

## Creating Custom Styles

### Create New Style
```bash
/output-style:new
```

This launches an interactive dialog to:
1. Name your style
2. Describe its purpose
3. Define custom instructions/behaviors

## Custom Style Structure

### Required Components

#### 1. Name
Unique identifier for the style.

```
code-reviewer
```

#### 2. Description
Brief summary of the style's purpose.

```
Focuses on thorough code review with security and performance analysis
```

#### 3. Instructions
Detailed behavior modifications in Markdown format.

```markdown
# Code Reviewer Style

## Focus Areas
- Security vulnerabilities
- Performance bottlenecks
- Code maintainability
- Best practices adherence

## Response Format
1. Executive summary
2. Critical issues
3. Recommendations
4. Code examples

## Tone
- Constructive and educational
- Detail-oriented
- Security-conscious
```

## Storage Locations

### User Level
```
~/.claude/output-styles/
```

Available across all projects for the current user.

### Project Level
```
.claude/output-styles/
```

Shared with team via source control, project-specific styles.

## Example Custom Styles

### Technical Writer Style
```yaml
name: technical-writer
description: Documentation-focused with clarity and completeness emphasis
```

Behavior: Prioritizes clear explanations, comprehensive documentation, and user-facing language.

### Performance Optimizer Style
```yaml
name: performance-optimizer
description: Focuses on code optimization and performance improvements
```

Behavior: Analyzes efficiency, suggests optimizations, benchmarks solutions.

### Security Auditor Style
```yaml
name: security-auditor
description: Security-first approach with threat modeling
```

Behavior: Reviews for vulnerabilities, suggests security hardening, follows security best practices.

## Managing Custom Styles

### List Available Styles
```bash
/output-style
```

Shows both built-in and custom styles.

### Edit Custom Style
Directly modify files in:
- User: `~/.claude/output-styles/<style-name>.md`
- Project: `.claude/output-styles/<style-name>.md`

### Remove Custom Style
Delete the style file from the output-styles directory.

## Best Practices

### Style Design
- Keep instructions focused and specific
- Define clear behavioral changes
- Avoid conflicting directives
- Test with representative tasks

### Style Organization
- Use descriptive names
- Document purpose clearly
- Version control project-level styles
- Share useful styles with team

### Style Selection
- Choose appropriate style for task type
- Switch styles as needed during work
- Create specialized styles for recurring workflows