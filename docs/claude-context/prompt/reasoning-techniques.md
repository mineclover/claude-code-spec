# Reasoning Techniques

## Chain of Thought (CoT)

### When to Use
- Complex tasks requiring step-by-step reasoning
- Multi-step analysis or problem-solving
- Tasks a human would carefully think through
- Debugging reasoning processes

### Critical Rule
**Always have Claude output its thinking. Without outputting its thought process, no thinking occurs!**

## Techniques (Progressive Complexity)

### 1. Basic CoT
Simply include: "Think step-by-step"

**Example:**
```
Analyze this code for bugs. Think step-by-step.
```

### 2. Guided CoT
Outline specific thinking steps to follow:

**Example:**
```
Analyze this code for bugs:
1. Review variable initialization
2. Check loop conditions
3. Verify edge cases
4. Identify potential race conditions
5. Summarize findings
```

### 3. Structured CoT
Use XML tags to separate thinking from output:

**Example:**
```xml
Analyze this code for bugs.

<thinking>
[Your reasoning process here]
</thinking>

<answer>
[Your final response here]
</answer>
```

## Benefits

### Improved Accuracy
Step-by-step reasoning reduces errors in complex tasks

### Coherent Responses
Structured thinking leads to more logical outputs

### Debuggable Reasoning
Review thinking blocks to understand and improve Claude's approach

### Better for Complex Tasks
Particularly effective for:
- Mathematical calculations
- Code analysis
- Research synthesis
- Multi-criteria decision making

## Considerations

### When NOT to Use
- Simple, straightforward queries
- Tasks requiring brief responses
- Speed-critical applications

### Trade-offs
- Increases output length
- May increase latency
- Higher token usage

## Best Practices

1. **Match complexity to task**: Simple tasks don't need elaborate CoT
2. **Review thinking blocks**: Learn how Claude approaches problems
3. **Refine guidance**: Adjust thinking steps based on results
4. **Combine with examples**: Show desired reasoning patterns