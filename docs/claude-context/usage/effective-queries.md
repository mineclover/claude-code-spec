# Effective Query Patterns

## Core Principles

### 1. Start Broad, Then Narrow
Begin with high-level exploration before diving into specifics.

**Pattern:**
```
Step 1: "explain the overall architecture"
Step 2: "how does authentication work?"
Step 3: "show me the JWT token validation logic"
```

**Why:** Builds context progressively, allowing Claude to understand relationships.

### 2. Be Specific and Use Domain Language
Provide precise, project-specific terminology.

**Weak Query:**
```
fix the problem
```

**Strong Query:**
```
fix the race condition in src/cache/redis.ts where concurrent requests
cause duplicate database writes
```

**Why:** Specificity reduces ambiguity and speeds up resolution.

### 3. Provide Context
Include relevant information for accurate responses.

**Components:**
- Error messages
- Code snippets
- Reproduction steps
- Expected vs actual behavior

**Example:**
```
When I run `npm test`, I get "TypeError: Cannot read property 'id' of undefined"
in user.test.ts:23. The test creates a user without an email field,
but the User.validate() method expects it. Should we make email optional
or update the test?
```

## Query Modes

### Plan Mode
Safe, read-only analysis without code changes.

**Activate:**
```bash
claude --permission-mode plan
```

**Or in session:**
```
Shift+Tab (toggle mode)
```

**Use Cases:**
- Codebase exploration
- Architecture analysis
- Impact assessment
- Learning unfamiliar code

**Example:**
```
[Plan Mode] analyze how user authentication flows from login to session creation
```

### Extended Thinking
Complex problem-solving with deeper reasoning.

**Activate:**
```
Tab (in interactive mode)
```

**Use Cases:**
- Complex architectural decisions
- Multi-step refactoring plans
- Performance optimization strategies
- Debugging intricate issues

**Example:**
```
[Extended Thinking] design a caching strategy for our API that balances
memory usage, response time, and data freshness
```

## Reference Techniques

### File References
Use `@` to reference files and directories.

**Single File:**
```
@src/api/users.ts explain the getUserById function
```

**Multiple Files:**
```
review @src/models/User.ts @src/api/users.ts @tests/user.test.ts for consistency
```

**Directory:**
```
@src/api/ what endpoints are available?
```

### Code Location References
Point to exact locations using file:line notation.

**Format:**
```
file_path:line_number
```

**Example:**
```
in src/api/users.ts:45, add error handling for missing user IDs
```

### Error Message References
Include full error output for accurate diagnosis.

**Pattern:**
```
I'm getting this error:

[full error stack trace]

How do I fix it?
```

## Iterative Refinement

### Initial Query
Start with broad request.

**Example:**
```
create a user profile page
```

### Refine Based on Response
Add details from Claude's questions or initial implementation.

**Follow-up:**
```
add profile picture upload with image preview and validation for file size < 5MB
```

### Verify and Adjust
Review implementation and request modifications.

**Refinement:**
```
move the upload button below the preview and add a loading spinner during upload
```

## Task Breakdown

### Complex Tasks
Break into sequential, manageable steps.

**Instead of:**
```
build a complete shopping cart system
```

**Use:**
```
1. create a Cart model with add/remove/update methods
2. build API endpoints for cart operations
3. create a cart UI component with item list and total
4. add checkout button that validates inventory
```

**Why:** Enables step-by-step verification and easier debugging.

### Analysis Before Implementation
Let Claude explore before making changes.

**Pattern:**
```
Step 1: "analyze the database schema for products and orders"
Step 2: "what changes are needed to support bundle discounts?"
Step 3: "implement bundle discount logic in the pricing service"
```

## Specialized Capabilities

### Subagents
Use specialized agents for specific tasks.

**View Available:**
```
/agents
```

**Common Agents:**
- Code review agent
- Testing agent
- Documentation agent

### Image Analysis
Provide visual context for UI/UX work.

**Pattern:**
```
[attach screenshot] implement this design for the login page
```

### Custom Slash Commands
Create project-specific shortcuts.

**Example:**
```
/deploy-staging "updated user API endpoints"
```

## Query Anti-Patterns

### Too Vague
❌ "make it better"
✅ "improve error handling by adding try-catch blocks and user-friendly messages"

### Missing Context
❌ "why doesn't this work?"
✅ "getUserById returns null for valid IDs after the database migration"

### Too Many Tasks
❌ "build the entire backend"
✅ "create the user authentication endpoints (register, login, logout)"

### No Verification Steps
❌ "implement feature X"
✅ "implement feature X, then verify it works with the existing test suite"

## Effective Query Checklist

- [ ] Specific about what to do
- [ ] Includes relevant context (errors, files, behavior)
- [ ] Uses file/directory references when applicable
- [ ] Broken into manageable steps if complex
- [ ] Specifies expected outcome
- [ ] Identifies verification method