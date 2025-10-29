---
name: General-Purpose Solutions
category: Code Work
description: Write solutions that work for all valid inputs, not just test cases
tags:
  - coding
  - algorithms
  - quality
---

# General-Purpose Solutions

## Core Principle

Write high-quality, general-purpose solutions that work correctly for all valid inputs, not just test cases.

## Rules

1. **Don't hard-code values**: Implement actual logic, not specific answers
2. **Don't optimize for tests**: Tests verify correctness, they don't define the solution
3. **Use standard tools**: Prefer standard library and built-in features over custom workarounds
4. **Think algorithmically**: Understand the problem and implement the correct algorithm

## Examples

### ❌ Bad: Test-Specific Solution
```typescript
function fibonacci(n: number): number {
  // Hard-coded test cases
  const testCases = {
    0: 0,
    1: 1,
    2: 1,
    3: 2,
    4: 3,
    5: 5
  };
  return testCases[n] || 0;
}
```

### ✅ Good: General Algorithm
```typescript
function fibonacci(n: number): number {
  if (n <= 1) return n;
  let prev = 0, curr = 1;
  for (let i = 2; i <= n; i++) {
    [prev, curr] = [curr, prev + curr];
  }
  return curr;
}
```

### ❌ Bad: Helper Script Workaround
```bash
# create_users.sh
echo "user1" >> users.txt
echo "user2" >> users.txt
echo "user3" >> users.txt
```

### ✅ Good: Proper Implementation
```typescript
function createUsers(usernames: string[]): void {
  const users = usernames.map(username => ({
    id: generateId(),
    username,
    createdAt: new Date()
  }));

  saveToDatabase(users);
}
```

## Approach

1. **Understand requirements**: Read the problem carefully
2. **Identify patterns**: What's the underlying logic?
3. **Design algorithm**: Think about the general solution
4. **Implement correctly**: Write clean, maintainable code
5. **Verify logic**: Ensure it handles edge cases and all valid inputs

## Quality Criteria

A general-purpose solution should be:

- **Correct**: Implements the right algorithm
- **Complete**: Handles all valid inputs
- **Robust**: Handles edge cases gracefully
- **Maintainable**: Clean, readable code
- **Extendable**: Easy to modify or enhance

## When Tests Fail

If tests fail with a general solution:
1. Review the algorithm - is it correct?
2. Check edge cases - are they handled?
3. Verify requirements - are tests correct?
4. If tests are wrong, inform the user

Don't create workarounds that pass tests but solve the wrong problem.
