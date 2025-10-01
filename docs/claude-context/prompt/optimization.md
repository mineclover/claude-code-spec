# Prompt Optimization

## Prompt Improver Tool

### Purpose
A tool to help optimize prompts for Claude by adding structure, clarity, and reasoning guidance.

### Enhancement Process

#### 1. Identify and Extract Examples
- Locate existing examples in your prompt
- Ensure examples demonstrate desired output

#### 2. Create Structured Template
- Organize content into clear sections
- Use XML tags for separation
- Define explicit output formatting

#### 3. Add Chain of Thought Reasoning
- Include step-by-step reasoning instructions
- Guide analytical processes
- Make thinking explicit

#### 4. Refine Example Formatting
- Structure examples consistently
- Show complete input-output pairs
- Cover diverse scenarios

## When to Use Prompt Improver

### Ideal Use Cases
✓ Complex tasks requiring high accuracy
✓ Scenarios needing detailed reasoning
✓ Outputs currently need significant improvement
✓ Tasks prioritizing thoroughness over speed

### Less Suitable Use Cases
✗ Simple, straightforward tasks
✗ Speed-critical applications
✗ Already well-performing prompts

## Best Practices for Optimization

### 1. Start Simple, Then Enhance
```
Basic → Add examples → Add reasoning → Add structure
```

### 2. Use XML Tags
Organize content into logical sections:
- `<instructions>`
- `<examples>`
- `<output_format>`
- `<reasoning_steps>`

### 3. Include Step-by-Step Reasoning
Guide Claude through analytical processes:
```xml
<reasoning_steps>
1. Analyze the input for [specific aspect]
2. Consider [relevant factors]
3. Evaluate [criteria]
4. Synthesize findings
</reasoning_steps>
```

### 4. Provide Explicit Output Requirements
Don't leave format to interpretation:
```xml
<output_format>
Provide response as JSON with fields:
- summary: Brief overview
- details: Array of findings
- confidence: Score 1-10
</output_format>
```

## Optimization Workflow

### Step 1: Assess Current Performance
- Run current prompt with test cases
- Document failure patterns
- Identify specific issues

### Step 2: Apply Targeted Improvements

**For accuracy issues:**
- Add more diverse examples
- Include chain of thought reasoning
- Clarify success criteria

**For format issues:**
- Use XML tags for structure
- Provide explicit format requirements
- Consider response prefilling

**For consistency issues:**
- Add multishot examples
- Define clear guidelines
- Use system prompts for role

### Step 3: Test and Iterate
- Run improved prompt with same test cases
- Compare results against original
- Refine based on remaining issues
- Gather edge cases for future improvement

## Optimization Checklist

### Clarity
- [ ] Instructions are explicit and unambiguous
- [ ] Context is provided
- [ ] Success criteria are defined

### Structure
- [ ] XML tags organize different sections
- [ ] Logical flow from context to task to output
- [ ] Clear separation of examples and instructions

### Examples
- [ ] 3-5 relevant examples provided
- [ ] Examples cover diverse scenarios
- [ ] Examples show desired output format

### Reasoning
- [ ] Chain of thought included when needed
- [ ] Thinking steps are explicit
- [ ] Reasoning is visible in output

### Format
- [ ] Output format is explicitly specified
- [ ] Structure is consistent with examples
- [ ] Parsing requirements are clear

## Before and After Example

### Before (Basic)
```
Analyze customer feedback and tell me what's important.

Feedback: "The app crashes frequently and customer support is slow."
```

### After (Optimized)
```xml
<role>
You are a Product Manager specializing in customer experience analysis.
</role>

<task>
Analyze customer feedback to identify issues and prioritize them.
</task>

<reasoning_steps>
1. Extract specific issues mentioned
2. Categorize by type (technical, service, etc.)
3. Assess severity based on customer impact
4. Assign priority level
</reasoning_steps>

<examples>
<example>
<feedback>"App is slow and UI is confusing"</feedback>
<analysis>
Issues: [Performance: "App is slow", UX: "UI is confusing"]
Severity: [Performance: High, UX: Medium]
Priority: Address performance first, then UX
</analysis>
</example>
</examples>

<feedback>
"The app crashes frequently and customer support is slow."
</feedback>

<output_format>
Provide analysis as:
Issues: [List with categories]
Severity: [Assessment for each]
Priority: [Recommended order with rationale]
</output_format>
```

## Key Takeaways

1. **Optimize progressively**: Don't over-engineer simple tasks
2. **Test empirically**: Measure improvement with real cases
3. **Document patterns**: Learn what works for your use cases
4. **Balance thoroughness and speed**: Choose optimization level based on requirements