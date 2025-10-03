import type { Agent, AgentMetadata } from '../types/agent';

/**
 * Parse agent markdown file content to Agent object
 */
export function parseAgentMarkdown(
  content: string,
  filePath: string,
  source: 'project' | 'user',
): Agent {
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('Invalid agent file: missing frontmatter');
  }

  const frontmatter = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length).trim();

  // Parse frontmatter (simple YAML parser)
  const metadata: Partial<AgentMetadata> = {};
  let currentKey: string | null = null;
  let isParsingArray = false;
  let isParsingObject = false;
  let currentArray: string[] = [];
  let currentObject: any = {};
  let objectKey: string | null = null;

  frontmatter.split('\n').forEach((line) => {
    const trimmedLine = line.trim();

    // Array item
    if (trimmedLine.startsWith('- ')) {
      if (isParsingArray && currentKey) {
        currentArray.push(trimmedLine.substring(2).trim().replace(/['"]/g, ''));
      }
    }
    // Object property
    else if (isParsingObject && trimmedLine.startsWith('- ')) {
      const [key, ...valueParts] = trimmedLine.substring(2).split(':');
      if (key && valueParts.length > 0) {
        const value = valueParts.join(':').trim().replace(/['"]/g, '');
        currentObject[key.trim()] = value;
      }
    }
    // New key-value pair
    else if (trimmedLine.includes(':')) {
      // Save previous array or object
      if (isParsingArray && currentKey && currentArray.length > 0) {
        (metadata as any)[currentKey] = currentArray;
        currentArray = [];
      }
      if (isParsingObject && currentKey && Object.keys(currentObject).length > 0) {
        (metadata as any)[currentKey] = currentObject;
        currentObject = {};
      }

      const [key, ...valueParts] = trimmedLine.split(':');
      const value = valueParts.join(':').trim();

      if (value === '') {
        // This might be start of array or object
        currentKey = key.trim();
        isParsingArray = false;
        isParsingObject = false;
      } else {
        currentKey = key.trim();
        (metadata as any)[currentKey] = value.replace(/['"]/g, '');
        isParsingArray = false;
        isParsingObject = false;
      }
    }
    // Check for nested keys (allowList, denyList under permissions)
    else if (trimmedLine.endsWith(':') && currentKey === 'permissions') {
      isParsingObject = true;
      objectKey = trimmedLine.slice(0, -1).trim();
      if (!currentObject[objectKey]) {
        currentObject[objectKey] = [];
      }
    }
    // Nested array items under object
    else if (trimmedLine.startsWith('- ') && isParsingObject && objectKey) {
      currentObject[objectKey].push(trimmedLine.substring(2).trim().replace(/['"]/g, ''));
    }
    // Check if this is an array key
    else if (currentKey && !isParsingArray && !isParsingObject) {
      isParsingArray = true;
    }
  });

  // Save last array or object
  if (isParsingArray && currentKey && currentArray.length > 0) {
    (metadata as any)[currentKey] = currentArray;
  }
  if (isParsingObject && currentKey && Object.keys(currentObject).length > 0) {
    (metadata as any)[currentKey] = currentObject;
  }

  // Validate required fields
  if (!metadata.name) {
    throw new Error('Invalid agent file: missing required field "name"');
  }
  if (!metadata.description) {
    throw new Error('Invalid agent file: missing required field "description"');
  }

  return {
    name: metadata.name,
    description: metadata.description,
    allowedTools: metadata.allowedTools,
    permissions: metadata.permissions,
    content: body,
    filePath,
    source,
  };
}

/**
 * Generate agent markdown content from Agent object
 */
export function generateAgentMarkdown(agent: Agent): string {
  let frontmatter = `---
name: ${agent.name}
description: ${agent.description}`;

  if (agent.allowedTools && agent.allowedTools.length > 0) {
    frontmatter += `\nallowedTools: [${agent.allowedTools.join(', ')}]`;
  }

  if (agent.permissions) {
    frontmatter += `\npermissions:`;
    if (agent.permissions.allowList && agent.permissions.allowList.length > 0) {
      frontmatter += `\n  allowList:`;
      agent.permissions.allowList.forEach((pattern) => {
        frontmatter += `\n    - "${pattern}"`;
      });
    }
    if (agent.permissions.denyList && agent.permissions.denyList.length > 0) {
      frontmatter += `\n  denyList:`;
      agent.permissions.denyList.forEach((pattern) => {
        frontmatter += `\n    - "${pattern}"`;
      });
    }
  }

  frontmatter += `\n---`;

  return `${frontmatter}\n\n${agent.content}`.trim();
}

/**
 * Validate agent data
 */
export function validateAgent(agent: Partial<AgentMetadata>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!agent.name) {
    errors.push('Agent name is required');
  } else if (!/^[a-z0-9-_]+$/i.test(agent.name)) {
    errors.push('Agent name must contain only letters, numbers, hyphens, and underscores');
  }

  if (!agent.description) {
    errors.push('Agent description is required');
  }

  if (agent.allowedTools) {
    if (!Array.isArray(agent.allowedTools)) {
      errors.push('allowedTools must be an array');
    } else if (agent.allowedTools.length === 0) {
      errors.push('allowedTools cannot be empty if specified');
    }
  }

  if (agent.permissions) {
    if (
      agent.permissions.allowList &&
      (!Array.isArray(agent.permissions.allowList) || agent.permissions.allowList.length === 0)
    ) {
      errors.push('permissions.allowList must be a non-empty array if specified');
    }
    if (
      agent.permissions.denyList &&
      (!Array.isArray(agent.permissions.denyList) || agent.permissions.denyList.length === 0)
    ) {
      errors.push('permissions.denyList must be a non-empty array if specified');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
