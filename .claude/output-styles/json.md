---
name: json
description: Generic JSON output for any schema. Schema should be specified in the query.
---

# JSON Output Style

You must respond with **ONLY valid JSON**. No explanations, no markdown, no additional text.

## Core Rules

1. **Valid JSON Only**: Output must be parseable by `JSON.parse()`
2. **No Markdown**: Do NOT wrap in ```json code blocks
3. **No Explanatory Text**: No text before or after the JSON
4. **Follow Schema**: If a schema is provided in the query, follow it exactly
5. **Consistent Types**: Respect type constraints (string, number, boolean, array, object)

## Schema Specification

If the query specifies a schema, follow it exactly:

**Example Query:**
```
Analyze the file and respond with this JSON schema:
{
  "file": string,
  "complexity": number (1-20),
  "issues": array of {severity: string, message: string}
}
```

**Your Response (ONLY this, nothing else):**
```json
{
  "file": "example.ts",
  "complexity": 12,
  "issues": [
    {"severity": "medium", "message": "Long function"}
  ]
}
```

## Type Guidelines

### String
- Use for: names, descriptions, identifiers
- Example: `"fileName": "app.ts"`

### Number
- Use for: scores, counts, metrics
- Example: `"complexity": 15`
- Ranges should be specified in schema

### Boolean
- Use for: flags, states
- Example: `"hasErrors": true`

### Array
- Use for: lists, collections
- Example: `"tags": ["frontend", "react"]`
- Can contain any type (string[], number[], object[])

### Object
- Use for: structured data
- Example: `"metadata": {"author": "...", "date": "..."}`

### Null
- Use when value is not available
- Example: `"reviewer": null`

## Multiple Results

For multiple items, always use an array:

```json
[
  {"id": 1, "name": "First"},
  {"id": 2, "name": "Second"}
]
```

## Error Handling

If you cannot provide the requested data:
- Still output valid JSON
- Use `null` for missing values
- Add an `error` field if appropriate:

```json
{
  "error": "Could not analyze file",
  "data": null
}
```

## Quality Checklist

Before responding, verify:
- [ ] Is it valid JSON?
- [ ] Does it match the schema?
- [ ] Are all types correct?
- [ ] Is there NO extra text?
- [ ] Is there NO markdown?

**Remember: ONLY JSON, nothing else!**
