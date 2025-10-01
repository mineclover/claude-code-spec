# XML Tags and Structure

## XML Tags

### Purpose
XML tags provide clarity by separating different prompt components and improving Claude's understanding.

### Benefits
- Prevents mixing up different prompt sections
- Improves accuracy of understanding
- Enables flexible prompt structuring
- Makes response parsing easier
- Improves organization and readability

### Best Practices

#### 1. Use Meaningful Tag Names
There are no canonical "best" XML tags - choose tags that logically describe the content.

**Common tag types:**
- `<instructions>` - Task guidelines
- `<example>` - Demonstration content
- `<context>` - Background information
- `<formatting>` - Output structure requirements
- `<document>` - Input documents
- `<thinking>` - Reasoning space
- `<answer>` - Final response

#### 2. Be Consistent
Use the same tag names throughout your prompt. Consistency helps Claude accurately interpret prompt structure and maintain expected behavior across interactions.

#### 3. Nest Tags Hierarchically
```xml
<task>
  <context>
    Background information here
  </context>
  <instructions>
    1. Step one
    2. Step two
  </instructions>
  <examples>
    <example>
      Demonstration here
    </example>
  </examples>
</task>
```

#### 4. Reference Tags in Instructions
```xml
<document>
Important content here
</document>

Analyze the content in <document> and extract key points.
```

### Combining with Other Techniques
XML tags work well with:
- Multishot prompting (wrap examples in tags)
- Chain of thought (separate thinking from answers)
- Long context (structure multiple documents)

## Response Prefilling

### Purpose
Direct Claude's response by starting with specific text to:
- Control output format
- Skip unnecessary preambles
- Maintain character consistency

### Use Cases

#### 1. Control Output Format
Force JSON output by prefilling with opening brace:
```
User: Generate user data in JSON format
Assistant: {
```

#### 2. Skip Preambles
Start directly with content:
```
User: List three ideas for improving user engagement
Assistant: 1.
```

#### 3. Maintain Character
Keep role-play consistency:
```
User: What do you think about this?
Assistant: [CHARACTER_NAME]:
```

### Best Practices
1. Prefill minimal text needed to guide direction
2. Use for format enforcement (JSON, XML)
3. Combine with clear instructions
4. Test effectiveness for your use case

### Important Constraints
- **Not compatible with extended thinking mode**
- **Cannot end with trailing whitespace**
- Requires careful crafting to achieve desired output

## Combining XML Tags and Prefilling

### Example: Structured Analysis with JSON Output

**Prompt structure:**
```xml
<task>
  <context>User feedback analysis</context>
  <instructions>
  Extract sentiment and priority from feedback
  </instructions>
  <output_format>JSON with fields: sentiment, priority, issue</output_format>
</task>

<feedback>
"Product keeps crashing when I try to save my work"
</feedback>

Provide analysis in JSON format.
```

**Prefilled response:**
```
{
```

This combination ensures structured prompt and controlled output format.

### Key Points for Effective Use

**When to combine:**
- Complex analysis tasks requiring structured input and formatted output
- Multi-document processing with specific output requirements
- Tasks needing both context separation and format control

**Benefits:**
- XML tags organize input and instructions clearly
- Prefilling ensures consistent output format
- Together they create predictable, parseable results
- Reduces need for post-processing

**Pro Tip:** Combine XML tags with multishot prompting and prefilling to create high-performance prompts that maintain consistency across varied inputs.