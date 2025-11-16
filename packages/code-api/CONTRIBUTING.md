# Contributing to code-api

Thank you for your interest in contributing to code-api! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Claude CLI installed and configured

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mineclover/claude-code-apis.git
   cd claude-code-apis
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Run tests to verify setup:
   ```bash
   npm test
   ```

## Project Structure

```
code-api/
├── src/
│   ├── client/           # Claude CLI client implementation
│   │   └── ClaudeClient.ts
│   ├── parser/           # Stream parsing and validation
│   │   ├── StreamParser.ts
│   │   ├── schemas.ts    # Zod schemas
│   │   └── types.ts
│   ├── process/          # Process management
│   │   └── ProcessManager.ts
│   ├── logger/           # Logging infrastructure
│   │   └── Logger.ts
│   ├── errors/           # Custom error classes
│   │   └── errors.ts
│   └── index.ts          # Public API exports
├── tests/
│   ├── unit/             # Unit tests
│   │   ├── StreamParser.test.ts
│   │   └── ProcessManager.test.ts
│   └── integration/      # Integration tests
├── docs/                 # Documentation
├── dist/                 # Compiled output
└── package.json

```

### Key Modules

- **ProcessManager**: Manages multiple Claude CLI executions with concurrency control
- **StreamParser**: Parses stream-json output with buffer management
- **ClaudeClient**: Low-level Claude CLI process wrapper
- **Logger**: Structured logging system
- **Schemas**: Zod schemas for runtime validation

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write code following the [Code Style](#code-style) guidelines
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### 4. Build and Verify

```bash
# Type check
npm run type-check

# Build
npm run build

# Lint (if configured)
npm run lint
```

## Testing

### Writing Tests

- Place unit tests in `tests/unit/`
- Place integration tests in `tests/integration/`
- Use descriptive test names that explain what is being tested
- Follow the AAA pattern: Arrange, Act, Assert
- Mock external dependencies appropriately

### Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StreamParser } from '../../src/parser/StreamParser';

describe('StreamParser', () => {
  let onEvent: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;
  let parser: StreamParser;

  beforeEach(() => {
    onEvent = vi.fn();
    onError = vi.fn();
    parser = new StreamParser(onEvent, onError);
  });

  it('should parse valid JSON lines', () => {
    // Arrange
    const event = { type: 'test', data: 'value' };

    // Act
    parser.processChunk(JSON.stringify(event) + '\n');

    // Assert
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(event);
  });
});
```

### Test Coverage

- Aim for >80% code coverage
- All new features must include tests
- Bug fixes should include regression tests

## Code Style

### TypeScript Guidelines

1. **Type Safety**
   - Use strict TypeScript configuration
   - Avoid `any` type; use `unknown` if type is truly unknown
   - Define explicit return types for public APIs
   - Use type guards for runtime type checking

2. **Naming Conventions**
   - Use `camelCase` for variables and functions
   - Use `PascalCase` for classes and interfaces
   - Use `UPPER_CASE` for constants
   - Prefix interfaces with `I` only when necessary for clarity

3. **Error Handling**
   - Use custom error classes from `src/errors/errors.ts`
   - Include context in error messages
   - Propagate errors with meaningful stack traces

4. **Logging**
   - Use the structured logger from `src/logger/Logger.ts`
   - Include module context in log messages
   - Use appropriate log levels (debug, info, warn, error)
   - Never use `console.*` directly

5. **Documentation**
   - Add JSDoc comments for public APIs
   - Include usage examples for complex functionality
   - Document error conditions and edge cases

### Code Example

```typescript
/**
 * Process a stream chunk with buffer overflow protection
 *
 * @param chunk - Data chunk from stdout (Buffer or string)
 * @throws {BufferOverflowError} When buffer exceeds maxBufferSize
 *
 * @example
 * ```typescript
 * const parser = new StreamParser(onEvent, onError, {
 *   maxBufferSize: 1024 * 1024 // 1MB
 * });
 * parser.processChunk(data);
 * ```
 */
processChunk(chunk: Buffer | string): void {
  const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');

  // Check buffer size
  if (this.buffer.length > this.maxBufferSize) {
    this.logger.error('Buffer overflow detected', undefined, {
      module: 'StreamParser',
      bufferSize: this.buffer.length,
      maxSize: this.maxBufferSize,
    });
    throw new BufferOverflowError(this.buffer.length, this.maxBufferSize);
  }

  // Process data...
}
```

## Commit Guidelines

### Commit Message Format

Use conventional commit format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

### Examples

```
feat(parser): add buffer overflow protection

- Implement maxBufferSize option
- Add buffer overflow detection
- Include onBufferOverflow callback
- Add tests for overflow scenarios

Closes #123
```

```
fix(process): handle null execution state safely

- Add getCurrentExecution() helper
- Replace unsafe null access patterns
- Improve type safety with optional chaining

Fixes #456
```

## Pull Request Process

1. **Before Submitting**
   - Update tests and documentation
   - Run full test suite: `npm test`
   - Build successfully: `npm run build`
   - Update CHANGELOG.md with your changes

2. **PR Description**
   - Clearly describe the problem and solution
   - Link related issues
   - Include screenshots for UI changes
   - List breaking changes if any

3. **Review Process**
   - Address review comments promptly
   - Keep the PR focused on a single concern
   - Squash commits if requested
   - Ensure CI passes

4. **After Merge**
   - Delete your feature branch
   - Close related issues

## Reporting Bugs

### Before Reporting

- Check existing issues to avoid duplicates
- Verify the bug exists in the latest version
- Collect relevant information

### Bug Report Template

```markdown
## Description
A clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- Node version:
- code-api version:
- OS:
- Claude CLI version:

## Additional Context
Any other relevant information
```

## Suggesting Enhancements

### Enhancement Proposal Template

```markdown
## Feature Description
Clear description of the proposed feature

## Motivation
Why is this feature needed?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Any other relevant information
```

## Questions?

If you have questions about contributing, please:

1. Check the [documentation](docs/)
2. Search existing [issues](https://github.com/mineclover/claude-code-apis/issues)
3. Open a new discussion

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

Thank you for contributing to code-api! 🎉
