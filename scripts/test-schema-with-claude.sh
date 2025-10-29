#!/bin/bash
# Test dynamic schema with actual Claude CLI

cd /Users/junwoobang/project/claude-code-spec

echo "=================================================="
echo "Testing Dynamic Schema with Claude CLI"
echo "=================================================="
echo ""

# Test 1: Simple custom schema
echo "--- Test 1: Simple File Analysis Schema ---"
echo ""

QUERY='Analyze src/lib/schemaBuilder.ts

Respond with JSON matching this exact schema:

```
{
  "file": string // File path,
  "linesOfCode": number (min: 0) // Total lines,
  "language": string (enum: typescript|javascript|python) // Programming language,
  "complexity": number (range: 1-20) // Code complexity,
  "mainPurpose": string // Primary purpose of file
}
```

**Important:**
- Output ONLY the JSON, no explanations
- Do NOT use markdown code blocks in your response
- Ensure all required fields are present
- Match types exactly'

echo "Sending query to Claude..."
echo ""

claude -p "$QUERY" \
  --output-format stream-json \
  --verbose \
  --mcp-config .claude/.mcp-empty.json \
  --strict-mcp-config \
  2>&1 | tee /tmp/schema-test-output.jsonl

echo ""
echo "--- Extracting result from stream ---"
echo ""

# Extract final result from stream-json output
grep '"type":"result"' /tmp/schema-test-output.jsonl | jq -r '.result' 2>/dev/null || echo "No result found in stream"

echo ""
echo "=================================================="
echo "Test Complete!"
echo "=================================================="
