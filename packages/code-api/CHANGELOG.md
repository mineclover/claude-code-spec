# Changelog

All notable changes to the code-api package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Structured Logging System** (`src/logger/Logger.ts`)
  - `Logger` interface with debug, info, warn, and error methods
  - `ConsoleLogger` implementation with JSON-formatted structured output
  - `SilentLogger` implementation for testing environments
  - Context-aware logging with module tracking
  - Error serialization with stack traces
  - Configurable log levels with filtering

- **Memory Management** (`src/process/ProcessManager.ts`)
  - `ProcessManagerOptions` interface for configuration
  - `maxHistorySize` option to limit completed executions kept in memory
  - `autoCleanupInterval` option for periodic automatic cleanup
  - `enforceHistoryLimit()` method using LRU pattern
  - `destroy()` method for proper resource cleanup
  - Automatic cleanup timer functionality

- **Performance Optimizations** (`src/parser/StreamParser.ts`)
  - `StreamParserOptions` interface for parser configuration
  - `maxBufferSize` option to prevent unbounded memory growth (default: 10MB)
  - Buffer overflow detection and handling
  - `onBufferOverflow` callback for overflow notifications
  - Automatic buffer clearing on overflow to prevent memory exhaustion

- **Testing Infrastructure**
  - Vitest testing framework with coverage support
  - Unit tests for `StreamParser` (11 tests, 100% coverage)
  - Unit tests for `ProcessManager` (25 tests)
  - Mock strategies for subprocess management
  - Test utilities for event validation

- **Documentation**
  - Comprehensive API reference (`docs/api-reference.md`)
  - Getting started guide (`docs/getting-started.md`)
  - Architecture documentation (`docs/architecture.md`)
  - Advanced usage patterns (`docs/advanced-usage.md`)

### Changed

- **Type Safety Improvements** (`src/process/ProcessManager.ts`)
  - Added `getCurrentExecution()` helper for safe null handling
  - Added `getCurrentSessionId()` helper for safe session ID access
  - Replaced unsafe null access patterns with optional chaining
  - Improved type guards for execution state checks

- **Error Handling** (`src/process/ProcessManager.ts`)
  - Enhanced `killExecution()` to throw `ProcessKillError` with context
  - Mark execution as 'failed' when kill operation fails
  - Better error propagation throughout execution lifecycle
  - Contextual error information for debugging

- **ProcessManager Integration**
  - All console.* calls replaced with structured logger
  - Logger instance configurable via `ProcessManagerOptions`
  - Consistent logging format across all operations
  - Module context included in all log messages

### Fixed

- StreamParser test schema validation issues
- Mock constructor errors in ProcessManager tests
- Buffer overflow memory leaks in stream parsing
- Execution state null reference errors

## [0.1.0] - 2024-11-16

### Added

- Initial release of code-api package
- `ProcessManager` for managing multiple Claude CLI executions
- `StreamParser` for parsing stream-json output
- `ClaudeClient` for Claude CLI process management
- Zod schemas for runtime type validation
- Custom error classes for type-safe error handling
- TypeScript type definitions for all APIs

### Features

- Parallel execution of multiple Claude CLI sessions
- Real-time stream parsing with ANSI escape sequence handling
- Session-based execution tracking
- Concurrent execution limits
- Event-driven architecture with callbacks
- Runtime schema validation with Zod
- Process lifecycle management (start, kill, cleanup)
- Execution statistics and monitoring

[unreleased]: https://github.com/mineclover/claude-code-apis/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mineclover/claude-code-apis/releases/tag/v0.1.0
