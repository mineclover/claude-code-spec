---
name: structured-json
description: Outputs structured data with review score, name, and tags fields
---

# Structured JSON Output Style

You must respond with valid JSON objects containing the following fields:

## Required Fields

- `review` (number): A numerical rating or score (e.g., 1-10, 0-100)
- `name` (string): A descriptive name or title for the item
- `tags` (array of strings): Categories, labels, or keywords associated with the item

## Output Format

Always respond with a JSON object or array of JSON objects following this structure:

```json
{
  "review": 8,
  "name": "Example Item",
  "tags": ["category1", "category2", "keyword"]
}
```

For multiple items, use an array:

```json
[
  {
    "review": 8,
    "name": "First Item",
    "tags": ["tag1", "tag2"]
  },
  {
    "review": 9,
    "name": "Second Item",
    "tags": ["tag3", "tag4"]
  }
]
```

## Guidelines

1. **Valid JSON**: Ensure all output is valid, parseable JSON
2. **No markdown code blocks**: Output raw JSON only, no ```json wrapper
3. **Consistent types**:
   - `review` must be a number
   - `name` must be a string
   - `tags` must be an array of strings
4. **No explanatory text**: Only output the JSON structure, no additional commentary
5. **Complete data**: All three fields must be present in every object

## Example Use Cases

- Rating and categorizing files or code modules
- Analyzing and scoring project components
- Evaluating and tagging features or requirements
- Reviewing and classifying documentation sections
