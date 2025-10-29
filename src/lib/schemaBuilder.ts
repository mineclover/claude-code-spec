/**
 * Schema Builder - Build JSON schema prompts for Claude
 *
 * Helps construct type-safe queries with explicit JSON schemas
 */

export type JSONType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';

export interface FieldSchema {
  type: JSONType;
  description?: string;
  required?: boolean;
  arrayItemType?: JSONType;
  objectSchema?: Record<string, FieldSchema>;
  enum?: any[];
  min?: number;
  max?: number;
}

export interface JSONSchema {
  [key: string]: FieldSchema;
}

/**
 * Build a JSON schema prompt string
 */
export function buildSchemaPrompt(schema: JSONSchema, instruction?: string): string {
  const sections: string[] = [];

  if (instruction) {
    sections.push(instruction);
    sections.push('');
  }

  sections.push('Respond with JSON matching this exact schema:');
  sections.push('');
  sections.push('```');
  sections.push('{');

  const fields = Object.entries(schema);
  fields.forEach(([key, field], index) => {
    const isLast = index === fields.length - 1;
    const line = buildFieldLine(key, field, isLast);
    sections.push(`  ${line}`);
  });

  sections.push('}');
  sections.push('```');
  sections.push('');
  sections.push('**Important:**');
  sections.push('- Output ONLY the JSON, no explanations');
  sections.push('- Do NOT use markdown code blocks in your response');
  sections.push('- Ensure all required fields are present');
  sections.push('- Match types exactly');

  return sections.join('\n');
}

/**
 * Build a single field line for schema
 */
function buildFieldLine(key: string, field: FieldSchema, isLast: boolean): string {
  const parts: string[] = [];

  // Field name
  parts.push(`"${key}":`);

  // Type description
  if (field.type === 'array' && field.arrayItemType) {
    parts.push(`array<${field.arrayItemType}>`);
  } else if (field.type === 'object' && field.objectSchema) {
    parts.push('object {...}');
  } else {
    parts.push(field.type);
  }

  // Constraints
  const constraints: string[] = [];

  if (field.enum) {
    constraints.push(`enum: ${field.enum.join('|')}`);
  }

  if (field.min !== undefined || field.max !== undefined) {
    if (field.min !== undefined && field.max !== undefined) {
      constraints.push(`range: ${field.min}-${field.max}`);
    } else if (field.min !== undefined) {
      constraints.push(`min: ${field.min}`);
    } else if (field.max !== undefined) {
      constraints.push(`max: ${field.max}`);
    }
  }

  if (field.required === false) {
    constraints.push('optional');
  }

  if (constraints.length > 0) {
    parts.push(`(${constraints.join(', ')})`);
  }

  // Description
  if (field.description) {
    parts.push(`// ${field.description}`);
  }

  // Trailing comma
  if (!isLast) {
    parts[parts.length - 1] += ',';
  }

  return parts.join(' ');
}

/**
 * Build schema for common patterns
 */
export const CommonSchemas = {
  /**
   * Code review schema
   */
  codeReview: (): JSONSchema => ({
    file: {
      type: 'string',
      description: 'File path',
      required: true
    },
    review: {
      type: 'number',
      description: 'Quality score',
      min: 1,
      max: 10,
      required: true
    },
    complexity: {
      type: 'number',
      description: 'Cyclomatic complexity',
      min: 1,
      max: 20,
      required: true
    },
    maintainability: {
      type: 'number',
      description: 'Maintainability index',
      min: 0,
      max: 100,
      required: true
    },
    issues: {
      type: 'array',
      arrayItemType: 'object',
      description: 'List of issues found',
      required: true
    },
    suggestions: {
      type: 'array',
      arrayItemType: 'string',
      description: 'Improvement suggestions',
      required: true
    }
  }),

  /**
   * Agent statistics schema
   */
  agentStats: (): JSONSchema => ({
    agentName: {
      type: 'string',
      description: 'Agent identifier',
      required: true
    },
    status: {
      type: 'string',
      description: 'Current status',
      enum: ['idle', 'busy'],
      required: true
    },
    tasksCompleted: {
      type: 'number',
      description: 'Number of completed tasks',
      min: 0,
      required: true
    },
    currentTask: {
      type: 'string',
      description: 'Current task ID',
      required: false
    },
    uptime: {
      type: 'number',
      description: 'Uptime in milliseconds',
      min: 0,
      required: true
    },
    performance: {
      type: 'object',
      description: 'Performance metrics',
      required: true
    }
  }),

  /**
   * Task execution plan schema
   */
  taskPlan: (): JSONSchema => ({
    taskId: {
      type: 'string',
      description: 'Task identifier',
      required: true
    },
    steps: {
      type: 'array',
      arrayItemType: 'object',
      description: 'Execution steps',
      required: true
    },
    total_estimated_duration: {
      type: 'string',
      description: 'Total estimated time',
      required: true
    },
    risks: {
      type: 'array',
      arrayItemType: 'string',
      description: 'Potential risks',
      required: true
    }
  }),

  /**
   * Simple review (like structured-json)
   */
  simpleReview: (): JSONSchema => ({
    review: {
      type: 'number',
      description: 'Quality score',
      min: 1,
      max: 10,
      required: true
    },
    name: {
      type: 'string',
      description: 'Item name',
      required: true
    },
    tags: {
      type: 'array',
      arrayItemType: 'string',
      description: 'Tags/categories',
      required: true
    }
  })
};

/**
 * Validate data against schema (runtime check)
 */
export function validateAgainstSchema(
  data: unknown,
  schema: JSONSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data is not an object'] };
  }

  const obj = data as Record<string, any>;

  // Check required fields
  for (const [key, field] of Object.entries(schema)) {
    if (field.required !== false && !(key in obj)) {
      errors.push(`Missing required field: ${key}`);
    }

    if (key in obj) {
      const value = obj[key];

      // Type check
      if (!checkType(value, field.type)) {
        errors.push(`Invalid type for ${key}: expected ${field.type}, got ${typeof value}`);
      }

      // Enum check
      if (field.enum && !field.enum.includes(value)) {
        errors.push(`Invalid value for ${key}: must be one of ${field.enum.join(', ')}`);
      }

      // Range check
      if (typeof value === 'number') {
        if (field.min !== undefined && value < field.min) {
          errors.push(`Value for ${key} is below minimum: ${value} < ${field.min}`);
        }
        if (field.max !== undefined && value > field.max) {
          errors.push(`Value for ${key} exceeds maximum: ${value} > ${field.max}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if value matches type
 */
function checkType(value: any, type: JSONType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return false;
  }
}

/**
 * Quick schema builder DSL
 */
export function schema(fields: JSONSchema): JSONSchema {
  return fields;
}

export function string(description?: string, required = true): FieldSchema {
  return { type: 'string', description, required };
}

export function number(
  description?: string,
  options?: { min?: number; max?: number; required?: boolean }
): FieldSchema {
  return {
    type: 'number',
    description,
    min: options?.min,
    max: options?.max,
    required: options?.required ?? true
  };
}

export function boolean(description?: string, required = true): FieldSchema {
  return { type: 'boolean', description, required };
}

export function array(
  itemType: JSONType,
  description?: string,
  required = true
): FieldSchema {
  return { type: 'array', arrayItemType: itemType, description, required };
}

export function object(description?: string, required = true): FieldSchema {
  return { type: 'object', description, required };
}

export function enumField(
  values: any[],
  description?: string,
  required = true
): FieldSchema {
  return { type: 'string', enum: values, description, required };
}
