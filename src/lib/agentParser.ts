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
      // If we encounter an array item and currentKey is set, start array parsing
      if (currentKey && !isParsingObject) {
        if (!isParsingArray) {
          isParsingArray = true;
          currentArray = [];
        }
        currentArray.push(trimmedLine.substring(2).trim().replace(/['"]/g, ''));
      }
      // Nested array items under object
      else if (isParsingObject && objectKey) {
        currentObject[objectKey].push(trimmedLine.substring(2).trim().replace(/['"]/g, ''));
      }
    }
    // New key-value pair
    else if (trimmedLine.includes(':')) {
      // Save previous array or object
      if (isParsingArray && currentKey && currentArray.length > 0) {
        (metadata as any)[currentKey] = currentArray;
        currentArray = [];
        isParsingArray = false;
      }
      if (isParsingObject && currentKey && Object.keys(currentObject).length > 0) {
        (metadata as any)[currentKey] = currentObject;
        currentObject = {};
        isParsingObject = false;
      }

      const [key, ...valueParts] = trimmedLine.split(':');
      const value = valueParts.join(':').trim();

      if (value === '') {
        const keyName = key.trim();

        // Special handling for nested objects (permissions)
        if (currentKey === 'permissions') {
          // This is a nested key like allowList or denyList
          isParsingObject = true;
          objectKey = keyName;
          if (!currentObject[objectKey]) {
            currentObject[objectKey] = [];
          }
        } else {
          // Regular key for array or simple value
          currentKey = keyName;
        }
      } else {
        currentKey = key.trim();
        const cleanValue = value.replace(/['"]/g, '');

        // Handle "tools" field (Claude Code format) - convert to allowedTools array
        if (currentKey === 'tools') {
          // Split by comma and trim each tool name
          const toolsArray = cleanValue.split(',').map(t => t.trim()).filter(t => t);
          (metadata as any)['allowedTools'] = toolsArray;
        } else {
          (metadata as any)[currentKey] = cleanValue;
        }

        isParsingArray = false;
        isParsingObject = false;
      }
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

  // Use Claude Code compatible format: "tools: tool1, tool2, tool3"
  if (agent.allowedTools && agent.allowedTools.length > 0) {
    frontmatter += `\ntools: ${agent.allowedTools.join(', ')}`;
  }

  // Add model field (Claude Code standard)
  frontmatter += `\nmodel: sonnet`;

  // Add color field (UI hint)
  frontmatter += `\ncolor: blue`;

  frontmatter += `\n---`;

  // Ensure content is a string (handle undefined/null)
  let bodyContent = agent.content || '';

  // Add permissions as documentation in body (Claude Code doesn't support permissions in frontmatter)
  if (agent.permissions) {
    let permissionsDoc = '\n## 권한 가이드라인\n\n';
    if (agent.permissions.allowList && agent.permissions.allowList.length > 0) {
      permissionsDoc += '**허용:**\n';
      agent.permissions.allowList.forEach((pattern) => {
        permissionsDoc += `- ${pattern}\n`;
      });
    }
    if (agent.permissions.denyList && agent.permissions.denyList.length > 0) {
      permissionsDoc += '\n**거부:**\n';
      agent.permissions.denyList.forEach((pattern) => {
        permissionsDoc += `- ${pattern}\n`;
      });
    }
    // Prepend permissions to content
    bodyContent = permissionsDoc + '\n' + bodyContent;
  }

  return `${frontmatter}\n\n${bodyContent}`.trim();
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
