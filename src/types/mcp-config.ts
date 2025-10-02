/**
 * MCP Configuration Types for Claude Code
 * Based on Model Context Protocol (MCP) specification
 */

/**
 * Server transport types
 */
export type McpServerType = 'stdio' | 'http' | 'sse';

/**
 * Network transport protocols for HTTP/SSE servers
 */
export type NetworkTransport = 'http' | 'sse';

/**
 * Authentication types
 */
export type AuthType = 'oauth' | 'bearer' | 'basic';

/**
 * Configuration scopes
 */
export type ConfigScope = 'user' | 'project' | 'local';

/**
 * Authentication configuration
 */
export interface McpAuth {
  /** Authentication type */
  type: AuthType;
  /** Authentication token (for bearer auth), supports ${VAR} expansion */
  token?: string;
  /** Username (for basic auth) */
  username?: string;
  /** Password (for basic auth), supports ${VAR} expansion */
  password?: string;
}

/**
 * Server metadata
 */
export interface McpMetadata {
  /** Human-readable server description */
  description?: string;
  /** Server version (semver format) */
  version?: string;
  /** Server author or maintainer */
  author?: string;
  /** Categorization tags */
  tags?: string[];
}

/**
 * Base MCP server configuration
 */
export interface McpServerBase {
  /** Server transport type */
  type: McpServerType;
  /** Environment variables, supports ${VAR} and ${VAR:-default} expansion */
  env?: Record<string, string>;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Optional server metadata */
  metadata?: McpMetadata;
}

/**
 * Stdio server configuration
 */
export interface McpStdioServer extends McpServerBase {
  type: 'stdio';
  /** Executable command */
  command: string;
  /** Command arguments, supports ${VAR} and ${VAR:-default} expansion */
  args?: string[];
}

/**
 * HTTP/SSE server configuration
 */
export interface McpNetworkServer extends McpServerBase {
  type: 'http' | 'sse';
  /** Server URL */
  url: string;
  /** Network transport protocol */
  transport?: NetworkTransport;
  /** Authentication configuration */
  auth?: McpAuth;
}

/**
 * Union type for all MCP server configurations
 */
export type McpServer = McpStdioServer | McpNetworkServer;

/**
 * Root MCP configuration object
 */
export interface McpConfig {
  /** Collection of MCP server configurations */
  mcpServers: Record<string, McpServer>;
}

/**
 * Configuration file locations by scope
 */
export const MCP_CONFIG_PATHS = {
  user: '~/.claude.json',
  project: '.mcp.json',
  local: '.mcp.local.json',
} as const;

/**
 * Configuration scope precedence (highest to lowest)
 */
export const SCOPE_PRECEDENCE: ConfigScope[] = ['local', 'project', 'user'];

/**
 * Type guard for stdio server
 */
export function isStdioServer(server: McpServer): server is McpStdioServer {
  return server.type === 'stdio';
}

/**
 * Type guard for network server (HTTP/SSE)
 */
export function isNetworkServer(server: McpServer): server is McpNetworkServer {
  return server.type === 'http' || server.type === 'sse';
}

/**
 * Type guard for OAuth authentication
 */
export function isOAuthAuth(auth?: McpAuth): boolean {
  return auth?.type === 'oauth';
}

/**
 * Type guard for bearer token authentication
 */
export function isBearerAuth(auth?: McpAuth): boolean {
  return auth?.type === 'bearer';
}

/**
 * Type guard for basic authentication
 */
export function isBasicAuth(auth?: McpAuth): boolean {
  return auth?.type === 'basic';
}

/**
 * Example configurations
 */
export const EXAMPLE_CONFIGS: Record<string, McpServer> = {
  github: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a placeholder for environment variable
      GITHUB_TOKEN: '${GITHUB_TOKEN}',
    },
    metadata: {
      description: 'GitHub integration server',
      version: '1.0.0',
      tags: ['vcs', 'github'],
    },
  },
  sentry: {
    type: 'http',
    url: 'https://mcp.sentry.dev/mcp',
    transport: 'http',
    auth: {
      type: 'oauth',
    },
    timeout: 30000,
    metadata: {
      description: 'Sentry error monitoring',
      tags: ['monitoring', 'errors'],
    },
  },
  database: {
    type: 'stdio',
    command: 'npx',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a placeholder for environment variable
    args: ['-y', '@bytebase/dbhub', '--dsn', '${DATABASE_URL:-postgresql://localhost:5432/dev}'],
    env: {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a placeholder for environment variable
      DATABASE_URL: '${DATABASE_URL}',
    },
    metadata: {
      description: 'PostgreSQL database server',
      tags: ['database', 'sql'],
    },
  },
  memory: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    metadata: {
      description: 'Persistent memory server',
      tags: ['memory', 'storage'],
    },
  },
  analytics: {
    type: 'sse',
    url: 'https://api.example.com/mcp',
    transport: 'sse',
    auth: {
      type: 'bearer',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a placeholder for environment variable
      token: '${API_TOKEN}',
    },
    metadata: {
      description: 'Real-time analytics server',
      tags: ['analytics', 'streaming'],
    },
  },
};
