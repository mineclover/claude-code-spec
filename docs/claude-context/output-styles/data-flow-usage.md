# Data Flow Output Style Usage Guide

## Overview

The `data-flow` output style is designed to help track, document, and validate data transformations across task boundaries in LangGraph workflows. It provides structured visibility into how data moves through your workflow.

## When to Use

Use the `data-flow` style when you need to:

1. **Debug Data Issues**: Track down where data gets corrupted or lost
2. **Design Workflows**: Plan data dependencies between tasks
3. **Optimize Performance**: Identify unnecessary data transfers
4. **Document Workflows**: Create clear data flow documentation
5. **Validate Data**: Ensure data contracts are met between tasks
6. **Onboard Team Members**: Help others understand workflow data patterns

## Activation

### Via Command Line
```bash
/output-style data-flow
```

### Via Query
```bash
claude -p "Using data-flow style, analyze the workflow in src/services/LangGraphEngine.ts"
```

## Use Case Examples

### Example 1: Analyzing Existing Workflow

**Query:**
```
Analyze the data flow in the current LangGraph workflow implementation.
Focus on how task results are passed between nodes.
```

**Expected Output:**
```json
{
  "workflowId": "current-implementation",
  "dataFlowMap": {
    "nodes": [
      {
        "id": "task-execution",
        "inputs": ["task", "workflowState", "projectPath"],
        "outputs": ["executionResult", "updatedTaskProgress"]
      }
    ],
    "edges": [
      {
        "from": "task-execution",
        "to": "state-update",
        "data": ["executionResult", "taskProgress"],
        "dataType": "object"
      }
    ]
  },
  "dataLineage": {
    "taskProgress": {
      "origin": "initial-state",
      "path": ["initial-state", "task-execution", "state-update"],
      "transformations": ["initialize", "update-metrics", "merge"]
    }
  }
}
```

### Example 2: Debugging Missing Data

**Query:**
```
Why is the tokenUsage field sometimes null in taskProgress?
Trace the data flow from StreamParser to taskProgress.
```

**Expected Output:**
```json
{
  "issue": "tokenUsage null in taskProgress",
  "dataTrace": {
    "source": "StreamParser.parseStreamEvent",
    "path": [
      {
        "step": "StreamParser.parseStreamEvent",
        "output": "usage: { input_tokens, output_tokens, ... }",
        "status": "data present"
      },
      {
        "step": "eventToTaskProgress",
        "input": "event.usage",
        "transformation": "map to tokenUsage",
        "output": "tokenUsage: {...}",
        "status": "conditional - only for 'result' events"
      },
      {
        "step": "taskProgress merge",
        "condition": "event.type === 'result'",
        "outcome": "if false, tokenUsage remains undefined",
        "issue": "Not all events have tokenUsage"
      }
    ],
    "rootCause": "tokenUsage only populated for 'result' events, not for 'assistant' or 'tool' events",
    "recommendation": "Initialize tokenUsage as null in taskProgress, update only on result events"
  }
}
```

### Example 3: Planning New Task Integration

**Query:**
```
I want to add a new task that validates user input before processing.
What data should it receive and output?
```

**Expected Output:**
```json
{
  "taskId": "input-validation",
  "taskName": "Validate User Input",
  "dataFlow": {
    "input": {
      "schema": {
        "rawInput": "string",
        "validationRules": "object",
        "context": "object (optional)"
      },
      "source": "initial-state or user-input-task",
      "dependencies": {
        "required": ["rawInput", "validationRules"],
        "optional": ["context"]
      }
    },
    "transformation": {
      "operations": [
        "Parse input format",
        "Apply validation rules",
        "Sanitize input",
        "Generate validation report"
      ],
      "logic": "Check each rule, collect errors, return validated or error state"
    },
    "output": {
      "schema": {
        "isValid": "boolean",
        "validatedInput": "string (if valid)",
        "errors": "array of {field, message} (if invalid)",
        "sanitizedInput": "string"
      },
      "destination": ["processing-task or error-handler"],
      "conditionalRouting": {
        "if isValid": "route to processing-task",
        "if !isValid": "route to error-handler"
      }
    }
  },
  "integrationPoints": {
    "before": "user-input-task or workflow-start",
    "after": "processing-task (success) or error-handler (failure)",
    "dataContract": {
      "consumes": ["rawInput", "validationRules"],
      "produces": ["validatedInput", "errors"],
      "sideEffects": ["validation logs"]
    }
  }
}
```

### Example 4: Optimizing Data Transfer

**Query:**
```
The workflow is slow due to large data transfers between tasks.
Analyze what data is actually needed vs what's being passed.
```

**Expected Output:**
```json
{
  "analysis": "Data Transfer Optimization",
  "findings": [
    {
      "edge": "task-a → task-b",
      "currentData": {
        "fields": ["userId", "fullUserProfile", "preferences", "history"],
        "estimatedSize": "~500KB per execution"
      },
      "actualUsage": {
        "usedFields": ["userId", "preferences"],
        "unusedFields": ["fullUserProfile", "history"],
        "wastedData": "~450KB per execution"
      },
      "recommendation": {
        "newSchema": {
          "userId": "string",
          "preferences": "object (only needed fields)"
        },
        "estimatedSavings": "90% reduction in data transfer",
        "breakingChange": false,
        "implementation": "Update task-a output to filter unnecessary fields"
      }
    }
  ],
  "totalOptimizationPotential": {
    "currentTotalTransfer": "2.5MB per workflow",
    "optimizedTotalTransfer": "250KB per workflow",
    "reduction": "90%"
  }
}
```

### Example 5: Documenting Workflow for Team

**Query:**
```
Generate comprehensive data flow documentation for the user registration workflow.
Include all tasks, data transformations, and validation points.
```

**Expected Output:**
```markdown
# User Registration Workflow - Data Flow Documentation

## Overview
This workflow processes new user registrations with validation, enrichment, and storage.

## Workflow Graph
```
START → validate-input → enrich-data → store-user → send-welcome → END
```

## Task Data Flows

### Task 1: validate-input
**Purpose**: Validate user registration data

**Input Schema**:
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "name": "string (optional)",
  "metadata": "object (optional)"
}
```

**Transformation**:
1. Email format validation (RFC 5322)
2. Password strength check (min 8 chars, complexity rules)
3. Name sanitization (XSS prevention)
4. Metadata validation (max 1KB)

**Output Schema**:
```json
{
  "isValid": "boolean",
  "validatedData": {
    "email": "string (normalized)",
    "passwordHash": "string",
    "name": "string (sanitized)",
    "metadata": "object (validated)"
  },
  "validationErrors": "array (if invalid)"
}
```

**Data Flow**:
- Source: User input / API request
- Destination: enrich-data (if valid) or error-handler (if invalid)
- Conditional: Routes based on `isValid` field

---

### Task 2: enrich-data
**Purpose**: Add system metadata and defaults

**Input Schema**:
```json
{
  "email": "string",
  "passwordHash": "string",
  "name": "string",
  "metadata": "object"
}
```

**Transformation**:
1. Generate unique userId (UUID v4)
2. Add timestamps (createdAt, updatedAt)
3. Set default preferences
4. Assign default role
5. Generate verification token

**Output Schema**:
```json
{
  "userId": "string (UUID)",
  "email": "string",
  "passwordHash": "string",
  "name": "string",
  "metadata": "object",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp",
  "preferences": "object (defaults)",
  "role": "string (default: 'user')",
  "verificationToken": "string"
}
```

**Data Flow**:
- Source: validate-input
- Destination: store-user
- Dependencies: Requires valid user data

---

[Additional tasks documented similarly...]

## Data Lineage

### userId
- **Origin**: enrich-data (generated)
- **Path**: enrich-data → store-user → send-welcome
- **Transformations**: None (immutable after generation)
- **Purpose**: Unique identifier for user record

### email
- **Origin**: User input
- **Path**: validate-input → enrich-data → store-user → send-welcome
- **Transformations**:
  - validate-input: Normalized to lowercase
  - Other tasks: Read-only
- **Purpose**: User contact and authentication

### verificationToken
- **Origin**: enrich-data (generated)
- **Path**: enrich-data → store-user → send-welcome
- **Transformations**: None
- **Purpose**: Email verification link
- **Lifecycle**: Expires after 24 hours

## Validation Points

1. **validate-input**: Initial data validation
2. **enrich-data**: Schema validation after enrichment
3. **store-user**: Database constraint validation
4. **send-welcome**: Email format re-validation

## Error Handling

### Data Validation Errors
- Caught at: validate-input
- Action: Return validation errors to client
- Data preserved: Original input (for user correction)

### Data Enrichment Errors
- Caught at: enrich-data
- Action: Retry with exponential backoff
- Fallback: Use default values

### Storage Errors
- Caught at: store-user
- Action: Rollback transaction, return error
- Data preserved: None (transaction rollback)

## Performance Considerations

### Data Volume
- Average input size: ~500 bytes
- Average output size: ~2KB
- Growth factor: 4x (due to enrichment)

### Bottlenecks
- store-user: Database write latency
- send-welcome: Email service API latency

### Optimization Opportunities
1. Batch email sending for multiple registrations
2. Cache default preferences template
3. Async verification token generation
```

## Best Practices

### 1. Be Specific
Always specify exact data fields, types, and transformations rather than high-level descriptions.

### 2. Include Examples
Provide concrete examples of data at each stage to make flows tangible.

### 3. Document Edge Cases
Note what happens with null values, empty arrays, missing fields, etc.

### 4. Trace Dependencies
Always map which tasks depend on which data from which sources.

### 5. Validate Assumptions
When analyzing existing code, verify your understanding with specific questions.

## Troubleshooting

### "Data flow is unclear"
**Solution**: Ask for specific task pairs to analyze in detail.

**Example**:
```
Focus on data flow between task-a and task-b specifically.
Show me the exact fields transferred.
```

### "Too much detail"
**Solution**: Request summary-level flow first, then drill down.

**Example**:
```
Give me a high-level data flow summary first.
Then I'll ask for details on specific tasks.
```

### "Schema not matching"
**Solution**: Ask for schema validation and migration path.

**Example**:
```
Compare the expected schema with actual data.
Show me where mismatches occur and how to fix them.
```

## Integration with Development Workflow

### During Design Phase
Use data-flow style to plan task boundaries and data contracts before implementation.

### During Development
Use data-flow style to validate that implementations match design specs.

### During Code Review
Use data-flow style to generate documentation for reviewers.

### During Debugging
Use data-flow style to trace data issues through the workflow.

### During Optimization
Use data-flow style to identify performance bottlenecks in data transfer.

## Combining with Other Styles

### data-flow + json
Get structured data flow analysis as pure JSON for programmatic processing.

### data-flow + explanatory
Get data flow analysis with educational explanations of design decisions.

### data-flow + learning
Interactive data flow exploration with suggestions for improvement.

## Reference

For more information on:
- Output styles basics: See `output-styles-basics.md`
- Custom output styles: See `output-styles-custom.md`
- LangGraph workflows: See `LANGGRAPH_ARCHITECTURE.md`
