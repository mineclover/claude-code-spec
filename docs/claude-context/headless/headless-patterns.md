# Headless Patterns

## Common Automation Patterns

### Automated Code Review
```bash
claude -p "Review changes for security issues" \
  --allowedTools "Read,Grep" \
  --output-format json \
  --permission-mode allow
```

### Multi-turn Automation
Use `--resume` with session IDs to maintain conversation context:

```bash
# Step 1: Initial analysis
SESSION_ID=$(claude -p "Analyze codebase structure" --output-format json | jq -r '.sessionId')

# Step 2: Continue with context
claude -r "$SESSION_ID" -p "Generate migration plan"

# Step 3: Execute with same context
claude -r "$SESSION_ID" -p "Apply migrations"
```

### Batch Processing
```bash
for file in src/**/*.ts; do
  claude -p "Review $file for type safety" \
    --allowedTools "Read" \
    --output-format json
done
```

### CI/CD Integration
```bash
#!/bin/bash
RESULT=$(claude -p "Run linting and format checks" \
  --allowedTools "Bash,Read" \
  --output-format json \
  --permission-mode allow)

if [ $? -eq 0 ]; then
  echo "Checks passed"
  exit 0
else
  echo "Checks failed: $RESULT"
  exit 1
fi
```

## Best Practices

### Error Handling
Always implement proper error handling and timeouts:

```bash
claude -p "Complex task" \
  --timeout 300000 \
  --output-format json || {
    echo "Task failed or timed out"
    exit 1
  }
```

### Tool Access Control
Use `--allowedTools` to restrict capabilities:

```bash
# Read-only analysis
claude -p "Analyze code" --allowedTools "Read,Grep"

# Safe modifications
claude -p "Update docs" --allowedTools "Read,Edit,Write"
```

### Rate Limiting
Implement delays between requests to respect API limits:

```bash
for task in "${tasks[@]}"; do
  claude -p "$task" --output-format json
  sleep 2  # 2-second delay between requests
done
```

### Session Lifecycle
Clean up sessions after completion:

```bash
SESSION_ID=$(claude -p "Start task" --output-format json | jq -r '.sessionId')
claude -r "$SESSION_ID" -p "Complete task"
# Session automatically cleaned up after inactivity
```

### Output Parsing
Use `jq` for JSON output parsing:

```bash
claude -p "Get metrics" --output-format json | \
  jq '.response.content[] | select(.type == "text") | .text'
```

## Integration Patterns

### GitHub Actions
```yaml
- name: Code Review with Claude
  run: |
    claude -p "Review PR changes" \
      --allowedTools "Read,Grep" \
      --output-format json \
      --permission-mode allow
```

### GitLab CI
```yaml
code_review:
  script:
    - claude -p "Analyze merge request" --output-format json
```

### Jenkins Pipeline
```groovy
stage('AI Review') {
  steps {
    sh 'claude -p "Review code quality" --output-format json'
  }
}
```