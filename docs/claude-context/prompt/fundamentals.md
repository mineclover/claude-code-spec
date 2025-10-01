# Prompt Engineering Fundamentals

## Core Principles

### Clarity Over Complexity
Prompt engineering is faster and more cost-effective than fine-tuning, with better:
- Resource efficiency and lower cost
- Faster iteration cycles
- Preserves general knowledge
- More transparent reasoning

### Progressive Enhancement
Apply techniques progressively based on task complexity:
1. Start with clear, direct instructions
2. Add examples when needed
3. Include reasoning steps for complex tasks
4. Structure with XML tags for clarity

## Be Clear and Direct

### Golden Rule
Show your prompt to a colleague with minimal context. If they're confused, Claude will be too.

### Key Strategies
1. **Treat Claude like a new employee**
   - Provide explicit contextual information
   - Explain purpose and intended audience
   - Describe workflow and end goal

2. **Structure Instructions**
   - Use numbered lists or bullet points
   - Follow sequential order
   - Be specific about output format

3. **Include Context**
   - What results will be used for
   - Target audience
   - Definition of success
   - Workflow integration

### Example Pattern
```
Task: [Clear statement]
Context: [Why this matters, who it's for]
Requirements:
1. [Specific instruction]
2. [Specific instruction]
Output format: [Exact format needed]
```

## Before Starting Any Task

### Define Success Criteria
- What does successful output look like?
- How will you measure quality?
- What are the constraints?

### Establish Testing
- Create test cases
- Define empirical validation methods
- Prepare comparison benchmarks

### Draft Initial Prompt
- Start simple and iterate
- Test with real examples
- Refine based on results

## Practical Guidelines

### Be Specific
Provide detailed context instead of vague requests.

**Instead of:**
```
fix the bug
```

**Try:**
```
fix the login bug where users see a blank screen after entering wrong credentials
```

### Use Step-by-Step Instructions
Break complex tasks into sequential steps.

**Example:**
```
1. create a new database table for user profiles
2. create an API endpoint to get and update user profiles
3. build a webpage that allows users to see and edit their information
```

### Let Claude Explore First
Before making changes, let Claude understand your code.

**Analysis First:**
```
analyze the database schema
```

**Then Request:**
```
build a dashboard showing products that are most frequently returned by our UK customers
```