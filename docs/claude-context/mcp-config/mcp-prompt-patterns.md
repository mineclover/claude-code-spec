# MCP Prompt Patterns

## Overview

Effective MCP server usage requires understanding how to reference resources, invoke tools, and structure prompts for optimal results. This guide provides proven patterns for working with MCP servers.

## Resource Referencing

### Using @ Symbol
Reference MCP resources directly in prompts using `@` syntax.

**Pattern:**
```
@[server-name]/[resource-path]
```

**Examples:**
```
Review the recent errors from @sentry/issues/recent

Analyze the database schema from @database/schema/users

Get GitHub PR status from @github/pulls/123
```

**Benefits:**
- Direct resource access
- Clear intent
- Type-safe references
- IDE autocomplete support

### Implicit Resource Loading
Let Claude discover and load resources automatically.

**Pattern:**
```
[Action] using [server description]
```

**Examples:**
```
Find all TypeScript errors using the Sentry server

Query the users table to count active accounts

Check the status of PR #456 on GitHub
```

**When to Use:**
- Exploratory queries
- Uncertain resource paths
- Discovery workflows
- Natural language preference

## Tool Invocation Patterns

### Explicit Tool Requests
Directly request specific tool execution.

**Pattern:**
```
Use the [server-name] [tool-name] tool to [action]
```

**Examples:**
```
Use the github create_issue tool to report this bug

Use the database query tool to fetch user statistics

Use the sentry resolve_issue tool to mark issue #123 as resolved
```

**Benefits:**
- Precise control
- Predictable behavior
- Clear audit trail
- Explicit permissions

### Task-Oriented Requests
Focus on goals, let Claude choose appropriate tools.

**Pattern:**
```
[Action] [context] via [server]
```

**Examples:**
```
Create a GitHub issue for this bug with full stack trace

Query active users from the last 30 days

Mark all resolved Sentry issues as acknowledged
```

**When to Use:**
- Complex multi-step tasks
- Unfamiliar with available tools
- Workflow automation
- High-level instructions

## Multi-Server Patterns

### Sequential Operations
Chain operations across multiple servers.

**Pattern:**
```
1. [Action on Server A]
2. [Action on Server B using results]
3. [Final action]
```

**Example:**
```
1. Query recent errors from Sentry
2. Create GitHub issues for each unique error
3. Update project board with new issues
```

### Data Correlation
Combine data from multiple sources.

**Pattern:**
```
Compare [data from server A] with [data from server B]
```

**Examples:**
```
Compare GitHub commit activity with Sentry error rates

Cross-reference Linear tickets with GitHub PRs

Match Stripe payments with database transactions
```

### Conditional Workflows
Use conditional logic based on server responses.

**Pattern:**
```
Check [condition on server A], then [action on server B]
```

**Examples:**
```
If Sentry shows critical errors, create urgent GitHub issues

When database records exceed threshold, notify via Slack

If Linear sprint incomplete, extend deadline and notify team
```

## Authentication Patterns

### OAuth Flow Initiation
Start OAuth authentication within prompts.

**Pattern:**
```
/mcp [optional-server-name]
```

**Examples:**
```
/mcp sentry
/mcp github
/mcp
```

**Workflow:**
1. Issue `/mcp` command
2. Follow browser authentication
3. Return to Claude Code
4. Resources now accessible

### Token Verification
Check authentication status before operations.

**Pattern:**
```
Verify [server] authentication, then [action]
```

**Examples:**
```
Verify GitHub authentication, then list my repositories

Check Sentry access, then fetch project errors

Confirm database connection, then run migration
```

## Error Handling Patterns

### Graceful Degradation
Request fallback behavior for server failures.

**Pattern:**
```
Try [primary action], if unavailable [fallback]
```

**Examples:**
```
Try fetching from live Sentry data, if unavailable use cached logs

Attempt database query, if connection fails read from backup file

Check GitHub API, if rate limited provide manual instructions
```

### Diagnostic Requests
Debug server connectivity issues.

**Pattern:**
```
Debug [server] connection and report status
```

**Examples:**
```
Debug Sentry MCP connection and list available tools

Test database server connectivity and show configuration

Verify GitHub authentication and display rate limits
```

## Performance Patterns

### Batching Operations
Group multiple operations for efficiency.

**Pattern:**
```
Batch [multiple items] in single [server] operation
```

**Examples:**
```
Batch create 10 GitHub issues in single API call

Query multiple Sentry projects simultaneously

Bulk update database records in single transaction
```

### Pagination Handling
Manage large result sets effectively.

**Pattern:**
```
Fetch first [n] [resources], summarize, then fetch more if needed
```

**Examples:**
```
Get first 20 Sentry errors, summarize patterns, fetch more if critical

Load 50 GitHub issues, identify priorities, request next page

Query 100 database records, analyze trends, continue if needed
```

### Caching Strategies
Request data caching for repeated operations.

**Pattern:**
```
Cache [resource] for this session, reuse for [operations]
```

**Examples:**
```
Cache GitHub repo metadata for this analysis session

Store Sentry project configuration for multiple queries

Load database schema once, use for all table operations
```

## Slash Command Patterns

### Server-Specific Commands
MCP servers can provide custom slash commands.

**Pattern:**
```
/mcp__[server]__[command] [args]
```

**Examples:**
```
/mcp__github__create_pr "Fix auth bug" main feature/auth-fix

/mcp__sentry__search "TypeError" last-24h

/mcp__database__migrate up
```

**Discovery:**
```
List available slash commands for [server]
```

### Prompt Templates
Use server-provided prompt templates.

**Pattern:**
```
Use [server] [prompt-name] prompt with [context]
```

**Examples:**
```
Use GitHub code-review prompt with PR #123

Use Sentry error-analysis prompt with issue ID

Use database schema-design prompt for users table
```

## Context Management

### Scoped Sessions
Limit server context for specific tasks.

**Pattern:**
```
For this task, only use [server] for [specific purpose]
```

**Examples:**
```
For this debugging session, only use Sentry for error lookup

During code review, only use GitHub for PR operations

For this query, only use database read-only operations
```

### Context Handoff
Explicitly transfer context between servers.

**Pattern:**
```
Extract [data] from [server A], format for [server B]
```

**Examples:**
```
Extract error details from Sentry, format as GitHub issue

Pull Linear requirements, structure as database schema

Get Stripe customer data, prepare for database import
```

## Best Practices

### Clear Scope Definition
Define what servers are needed upfront.

**Good:**
```
Using GitHub and Sentry servers, analyze errors from PR #456
```

**Avoid:**
```
Look at the PR and errors
```

### Explicit Permissions
State desired permissions clearly.

**Good:**
```
Read-only analysis of Sentry errors, no modifications
```

**Avoid:**
```
Fix all Sentry issues
```

### Incremental Operations
Break complex tasks into steps.

**Good:**
```
1. List Sentry errors
2. Review first 5 errors
3. Create GitHub issues if needed
```

**Avoid:**
```
Auto-create GitHub issues for all Sentry errors
```

### Verification Steps
Include verification in workflows.

**Good:**
```
Create GitHub issue, then verify it was created successfully
```

**Avoid:**
```
Create GitHub issue
```

## Common Anti-Patterns

### Avoid Ambiguous References
**Bad:**
```
Check the errors
```

**Good:**
```
Check Sentry errors from the last hour
```

### Don't Assume Server Availability
**Bad:**
```
Query the database
```

**Good:**
```
If database server is available, query user counts
```

### Avoid Implicit Batch Operations
**Bad:**
```
Create issues for everything
```

**Good:**
```
Create GitHub issues for the 3 critical Sentry errors identified
```

### Don't Mix Concerns Unnecessarily
**Bad:**
```
Update database, push to GitHub, notify Slack, all at once
```

**Good:**
```
First update database, verify success, then notify via Slack
```

## Example Workflows

### Bug Investigation Flow
```
1. Search Sentry for errors matching "authentication" in last 24h
2. For top 3 errors, fetch full stack traces
3. Check if GitHub issues exist for these errors
4. Create new issues for untracked errors
5. Link Sentry errors to GitHub issues
6. Summarize findings
```

### Database Analysis Flow
```
1. Query database for user growth metrics
2. Export results to CSV format
3. Create Airtable entry with analysis
4. Generate GitHub issue with recommendations
5. Notify team via Slack (if available)
```

### Code Review Integration
```
1. Fetch GitHub PR #123 changes
2. Check Sentry for related errors in changed files
3. Query database for affected data
4. Summarize risk assessment
5. Post review comment on GitHub PR
```

## Server-Specific Tips

### GitHub Server
- Always specify repo owner/name explicitly
- Use PR numbers for precise references
- Leverage labels for categorization
- Request review limits to avoid rate limiting

### Sentry Server
- Filter by time range to reduce noise
- Group errors by fingerprint
- Check resolved status before creating tickets
- Use project slugs for multi-project setups

### Database Servers
- Always preview queries before execution
- Use read-only mode for analysis
- Specify transaction boundaries explicitly
- Request row count limits for safety

### Memory Server
- Namespace data by context
- Clear irrelevant memories periodically
- Use structured keys for retrieval
- Verify storage before relying on recall