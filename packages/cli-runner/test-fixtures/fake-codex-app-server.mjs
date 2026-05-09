#!/usr/bin/env node
/*
 * Stub for `codex app-server` used by the CodexAppServerClient tests.
 *
 * Implements just enough of the JSON-RPC protocol to drive a single
 * fork → turn round-trip:
 *   - `initialize` → returns capabilities
 *   - `initialized` notification → ignored
 *   - `thread/fork` → returns a fresh thread id
 *   - `turn/start` → emits the canned notification sequence:
 *       turn/started, item/completed (agentMessage), thread/tokenUsage/updated, turn/completed
 *
 * Behavior is controlled by env vars so individual tests can vary the
 * fixture without writing a separate stub each time:
 *   - FAKE_CODEX_AGENT_MESSAGE: text of the agentMessage to emit
 *       (defaults to a hardcoded JSON object)
 *   - FAKE_CODEX_FAIL_TURN: "1" → emit turn/failed instead of turn/completed
 *   - FAKE_CODEX_REVERSE_RPC: "1" → also emit a reverse-RPC request
 *       mid-turn (execCommandApproval) so the client's auto-deny path
 *       gets exercised
 *   - FAKE_CODEX_INVALID_INIT: "1" → respond to `initialize` with an
 *       error so we can assert handshake failure surfacing
 */

import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);

let nextThreadIdCounter = 0;
let nextTurnIdCounter = 0;
let nextServerReqId = 1000;

const AGENT_MESSAGE =
  process.env.FAKE_CODEX_AGENT_MESSAGE ??
  '{"descriptions":{"3":"runs the rg command","4":"shows two matches","5":"summarizes the result"}}';

rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  // Notifications: nothing to do on the stub side beyond logging.
  if (!('id' in msg)) return;

  const id = msg.id;
  switch (msg.method) {
    case 'initialize': {
      if (process.env.FAKE_CODEX_INVALID_INIT === '1') {
        send({ jsonrpc: '2.0', id, error: { code: -32603, message: 'simulated init failure' } });
      } else {
        send({ jsonrpc: '2.0', id, result: { capabilities: { experimentalApi: true } } });
      }
      return;
    }
    case 'thread/fork': {
      nextThreadIdCounter += 1;
      const threadId = `fork-thread-${nextThreadIdCounter}`;
      send({ jsonrpc: '2.0', id, result: { thread: { id: threadId, items: [], status: 'idle' } } });
      return;
    }
    case 'thread/start': {
      nextThreadIdCounter += 1;
      const threadId = `start-thread-${nextThreadIdCounter}`;
      send({ jsonrpc: '2.0', id, result: { thread: { id: threadId, items: [], status: 'idle' } } });
      return;
    }
    case 'turn/start': {
      nextTurnIdCounter += 1;
      const turnId = `turn-${nextTurnIdCounter}`;
      const threadId = msg.params?.threadId ?? 'unknown-thread';
      send({
        jsonrpc: '2.0',
        id,
        result: { turn: { id: turnId, items: [], status: 'in_progress', error: null, startedAt: 1, completedAt: null, durationMs: null } },
      });
      // Drive the turn lifecycle on a microtask boundary so the
      // client's await on the request response settles first.
      setImmediate(() => {
        send({ method: 'turn/started', params: { threadId, turn: { id: turnId } } });
        if (process.env.FAKE_CODEX_REVERSE_RPC === '1') {
          // Server-initiated request — client should auto-deny.
          send({
            jsonrpc: '2.0',
            id: nextServerReqId++,
            method: 'execCommandApproval',
            params: { threadId, turnId, command: 'rm -rf /' },
          });
        }
        send({
          method: 'item/completed',
          params: {
            threadId,
            turnId,
            item: { type: 'agentMessage', id: 'm1', text: AGENT_MESSAGE, phase: null, memoryCitation: null },
          },
        });
        send({
          method: 'thread/tokenUsage/updated',
          params: {
            threadId,
            turnId,
            tokenUsage: {
              total: { totalTokens: 200, inputTokens: 50, cachedInputTokens: 1500, outputTokens: 100, reasoningOutputTokens: 50 },
              last: { totalTokens: 200, inputTokens: 50, cachedInputTokens: 1500, outputTokens: 100, reasoningOutputTokens: 50 },
              modelContextWindow: 200000,
            },
          },
        });
        if (process.env.FAKE_CODEX_FAIL_TURN === '1') {
          send({
            method: 'turn/failed',
            params: {
              threadId,
              turn: { id: turnId, status: 'failed', error: { code: 'oops', message: 'simulated failure' } },
            },
          });
        } else {
          send({
            method: 'turn/completed',
            params: {
              threadId,
              turn: { id: turnId, status: 'completed', error: null, startedAt: 1, completedAt: 2, durationMs: 1234 },
            },
          });
        }
      });
      return;
    }
    default: {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not implemented in stub: ${msg.method}` } });
    }
  }
});

// Keep the process alive until stdin closes (parent kills it).
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
