/**
 * Interpreter registry
 */

import type { CLIToolInterpreter } from '../types/cli-tool';
import { ClaudeInterpreter } from './ClaudeInterpreter';
import { CodexInterpreter } from './CodexInterpreter';
import { GeminiInterpreter } from './GeminiInterpreter';

const interpreters = new Map<string, CLIToolInterpreter>();

// Register built-in interpreters
interpreters.set('claude', new ClaudeInterpreter());
interpreters.set('codex', new CodexInterpreter());
interpreters.set('gemini', new GeminiInterpreter());

export function getInterpreter(interpreterType: string): CLIToolInterpreter | undefined {
  return interpreters.get(interpreterType);
}

export function registerInterpreter(
  interpreterType: string,
  interpreter: CLIToolInterpreter,
): void {
  interpreters.set(interpreterType, interpreter);
}

export function getRegisteredInterpreterTypes(): string[] {
  return Array.from(interpreters.keys());
}
