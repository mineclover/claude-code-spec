# System Prompts

## Purpose
System prompts set Claude's role and dramatically improve performance by:
- Enhancing accuracy in complex scenarios
- Tailoring communication style
- Improving focus on task requirements
- Creating virtual domain expertise

## Role Prompting Strategy

### Be Specific and Nuanced
Transform Claude from a general assistant into a virtual domain expert.

**Generic (Less Effective):**
```
You are a data scientist.
```

**Specific (More Effective):**
```
You are a data scientist specializing in customer insight analysis
for Fortune 500 companies, with 10 years of experience in retail
analytics and predictive modeling.
```

### Include Professional Context
- Years of experience
- Domain specialization
- Industry focus
- Specific expertise areas
- Professional perspective

## Prompt Structure

### Separation of Concerns
- **System/Role prompt**: Define role and general behavior
- **User message**: Provide task-specific instructions

**Example:**
```
System: You are a Senior Security Engineer specializing in application
security for financial services.

User: Review this authentication code for potential vulnerabilities.
```

## Effective Role Examples

### Legal Analysis
```
You are the General Counsel of a Fortune 500 tech company with
15 years of experience in intellectual property and contract law.
```

### Technical Writing
```
You are a Senior Technical Writer specializing in API documentation
for developer tools, with expertise in making complex concepts
accessible to diverse technical audiences.
```

### Code Review
```
You are a Staff Software Engineer with 12 years of experience in
distributed systems, focusing on code reliability, performance
optimization, and security best practices.
```

### Business Analysis
```
You are a Management Consultant specializing in operational efficiency
for manufacturing companies, with expertise in lean processes and
data-driven decision making.
```

## Benefits

### Performance Improvement
Right role definition leads to:
- More accurate responses
- Appropriate technical depth
- Domain-specific insights
- Relevant examples and references

### Communication Style
Role influences:
- Tone and formality
- Technical vocabulary
- Explanation approach
- Level of detail

### Task Focus
Clear role helps Claude:
- Prioritize relevant information
- Apply domain expertise
- Make informed judgments
- Provide actionable insights

## Experimentation Tips

1. **Test different role specificity levels**
   - Start specific, generalize if needed
   - Add context incrementally

2. **Match role to task complexity**
   - Complex tasks benefit from detailed roles
   - Simple tasks may need generic roles

3. **Combine with other techniques**
   - System prompt for role
   - User message for specific instructions
   - Examples for output format
   - XML tags for structure