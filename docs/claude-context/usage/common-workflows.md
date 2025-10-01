# Common Workflows

## Development Workflows

### Codebase Exploration
Progressive understanding of unfamiliar code.

**Workflow:**
```
1. "what's the overall structure of this project?"
2. "explain the main data models"
3. "how does authentication work?"
4. "show me the user registration flow"
```

**Best Practice:** Use Plan Mode to avoid accidental changes.

### Feature Implementation
Structured approach to adding new functionality.

**Workflow:**
```
1. "analyze how similar features are implemented"
2. "what files need to change to add feature X?"
3. "implement feature X in [specific files]"
4. "add tests for feature X"
5. "update documentation for feature X"
```

**Best Practice:** Break into small, verifiable steps.

### Bug Fixing
Systematic debugging and resolution.

**Workflow:**
```
1. Provide error message and reproduction steps
2. "find where this error originates"
3. "analyze why this happens"
4. "fix the issue and add error handling"
5. "verify the fix doesn't break existing tests"
```

**Best Practice:** Include full error stack traces.

### Code Review
Comprehensive code quality assessment.

**Workflow:**
```
1. git diff main | claude -p "review this PR"
2. Address feedback
3. "check if tests cover the new changes"
4. /commit "implement feature X with tests"
```

**Best Practice:** Use `/review` slash command for structured reviews.

### Refactoring
Safe code improvement without breaking functionality.

**Workflow:**
```
1. [Plan Mode] "analyze the current implementation of [module]"
2. "what are the code smells or improvement opportunities?"
3. "refactor [specific area] to [desired pattern]"
4. "verify all tests still pass"
```

**Best Practice:** Start in Plan Mode to understand impact.

## Request Patterns

### Be Specific
Provide detailed context in your requests.

**Instead of:**
```
fix the bug
```

**Use:**
```
fix the login bug where users see a blank screen after entering wrong credentials
```

### Step-by-Step Instructions
Break complex tasks into sequential steps.

**Example:**
```
1. create a new database table for user profiles
2. create an API endpoint to get and update user profiles
3. build a webpage that allows users to see and edit their information
```

### Analysis Before Changes
Let Claude explore before implementing.

**Pattern:**
```
analyze the database schema
```

Then request:
```
build a dashboard showing products that are most frequently returned by our UK customers
```

### Reference Specific Code
Point to exact locations.

**Example:**
```
in src/api/users.ts:45, add error handling to getUserById
```

## Integration Workflows

### Git Integration

**View Changes:**
```bash
git diff | claude -p "explain these changes"
```

**Create Commit:**
```
/commit
```

**Review PR:**
```bash
git diff main | claude -p "review this PR for security issues"
```

### Testing Integration

**Run and Fix Tests:**
```bash
npm test 2>&1 | claude -p "fix the failing tests"
```

**Generate Tests:**
```
create unit tests for src/api/users.ts covering all endpoints
```

**Test Coverage:**
```
analyze test coverage and suggest missing test cases
```

### Documentation Integration

**Generate Docs:**
```
generate API documentation for @src/api/
```

**Update README:**
```
update README.md to include setup instructions for the new authentication system
```

**Code Comments:**
```
add JSDoc comments to all functions in src/utils/validation.ts
```

## Productivity Patterns

### Piping Content
Combine CLI tools with Claude Code.

**Error Logs:**
```bash
tail -f logs/error.log | claude -p "monitor for critical errors and suggest fixes"
```

**Configuration Files:**
```bash
cat .env.example | claude -p "explain each environment variable"
```

**Code Snippets:**
```bash
pbpaste | claude -p "review this code"
```

### Session Continuation
Maintain context across sessions.

**Continue Previous:**
```bash
claude -c
```

**Resume Specific:**
```bash
claude --resume
```

**Use Case:** Return to complex multi-step tasks.

### Model Selection
Choose appropriate model for task complexity.

**Quick Tasks:**
```bash
claude --model sonnet
```

**Complex Analysis:**
```bash
claude --model opus
```

**Use Case:** Balance cost and capability.

## Quick Reference

### Interactive Mode Commands
- `Shift+Tab` - Toggle Plan Mode
- `Tab` - Enable Extended Thinking
- `/` - List slash commands
- `/help` - Get help

### Common Slash Commands
See `@context/usage/slash-commands.md` for complete list.

### Query Patterns
See `@context/usage/effective-queries.md` for detailed patterns.