# Advanced Techniques

## Prompt Chaining

### Concept
Break down complex tasks into smaller, manageable subtasks where each subtask gets Claude's full attention.

### Benefits

#### 1. Improved Accuracy
Each subtask receives focused attention, reducing errors

#### 2. Enhanced Clarity
Simpler subtasks mean clearer instructions and outputs

#### 3. Better Traceability
Easily identify and fix issues in the chain

### When to Use
- Multi-step tasks like research synthesis
- Document analysis pipelines
- Iterative content creation
- Complex workflows requiring verification

### Implementation Strategy

#### Step 1: Break Down the Task
Identify distinct, sequential steps:
```
Complex task: "Analyze customer feedback and generate improvement plan"

Chain:
1. Extract key themes from feedback
2. Categorize by urgency and impact
3. Identify root causes
4. Generate actionable recommendations
5. Prioritize by ROI
```

#### Step 2: Use XML Tags for Output Passing
```xml
Prompt 1: Extract themes
Output: <themes>Theme1, Theme2, Theme3</themes>

Prompt 2: Here are the themes: <themes>Theme1, Theme2, Theme3</themes>
Now categorize by urgency...
```

#### Step 3: Ensure Single Clear Objective
Each prompt should have one focused goal

### Advanced Pattern: Self-Correction
Claude reviews and improves its own work:
```
Step 1: Generate initial solution
Step 2: Review solution for errors
Step 3: Generate improved version
```

Particularly useful for high-stakes tasks requiring quality assurance.

## Long Context Tips

### 1. Document Placement Strategy

**Key Principle:** Put longform data at the top

Place long documents (20K+ tokens) before your query and instructions.
**Impact:** Up to 30% improvement in response quality

**Structure:**
```xml
<documents>
  <document index="1">
    <source>document_name.pdf</source>
    <document_content>
      {{LONG_DOCUMENT_CONTENT}}
    </document_content>
  </document>
</documents>

[Your instructions here]
```

### 2. XML Structure for Multiple Documents

Organize multiple documents clearly:
```xml
<documents>
  <document index="1">
    <source>quarterly_report.pdf</source>
    <document_content>{{CONTENT_1}}</document_content>
  </document>
  <document index="2">
    <source>market_analysis.pdf</source>
    <document_content>{{CONTENT_2}}</document_content>
  </document>
</documents>
```

### 3. Quote-Based Approach

Help Claude focus by requesting quote extraction first:

**Two-step process:**
```
Step 1:
Review the documents and extract relevant quotes related to [topic].

Step 2:
Based on these quotes: [EXTRACTED_QUOTES]
Now [complete the actual task]
```

**Benefits:**
- Cuts through noise in lengthy documents
- Focuses on most relevant information
- Improves accuracy for targeted analysis

### 4. Long Context Best Practices

#### Document Organization
- Index documents clearly
- Include source metadata
- Use consistent XML structure

#### Query Placement
- Place after documents
- Be specific about which documents to reference
- Reference document indices when relevant

#### Chunking Strategy
For extremely long contexts:
- Break into logical sections
- Process sections independently
- Synthesize results in final step

### 5. Clarity Enhancement

**Document organization:**
- Use clear section headers
- Include document summaries at the beginning
- Add navigation aids (indices, tags)
- Remove unnecessary verbosity
- Focus on relevant sections only

## Combining Advanced Techniques

### Example: Long Document Analysis Pipeline

```
Chain Step 1: Document Processing
- Input: Long documents at top
- Task: Extract relevant quotes
- Output: Structured quotes with sources

Chain Step 2: Analysis
- Input: Extracted quotes
- Task: Identify patterns and insights
- Output: Categorized findings

Chain Step 3: Synthesis
- Input: Categorized findings
- Task: Generate recommendations
- Output: Actionable plan
```

### Example: Self-Correcting Research

```
Step 1: Initial research
- Process long documents
- Extract key information

Step 2: Self-review
- Evaluate completeness
- Identify gaps
- Note potential errors

Step 3: Refinement
- Address identified gaps
- Correct errors
- Produce final output
```