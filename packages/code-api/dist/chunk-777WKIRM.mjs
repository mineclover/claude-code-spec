// src/schema/zodSchemaBuilder.ts
import { z } from "zod";
function isStandardSchema(schema) {
  return typeof schema === "object" && schema !== null && "~standard" in schema && typeof schema["~standard"] === "object";
}
function zodSchemaToPrompt(schema, instruction) {
  const sections = [];
  if (instruction) {
    sections.push(instruction);
    sections.push("");
  }
  sections.push("Respond with JSON matching this schema:");
  sections.push("");
  sections.push("```");
  sections.push(describeZodSchema(schema));
  sections.push("```");
  sections.push("");
  sections.push("**Important:**");
  sections.push("- Output ONLY the JSON, no explanations");
  sections.push("- Do NOT use markdown code blocks in your response");
  sections.push("- Ensure all required fields are present");
  sections.push("- Match types exactly");
  return sections.join("\n");
}
function describeZodSchema(schema, indent = 0) {
  const ind = "  ".repeat(indent);
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const lines = ["{"];
    const entries = Object.entries(shape);
    entries.forEach(([key, fieldSchema], index) => {
      const isLast = index === entries.length - 1;
      const desc = describeZodField(key, fieldSchema, indent + 1);
      lines.push(`${ind}  ${desc}${isLast ? "" : ","}`);
    });
    lines.push(`${ind}}`);
    return lines.join("\n");
  }
  return describeZodType(schema);
}
function describeZodField(key, schema, indent) {
  const type = describeZodType(schema);
  const desc = getZodDescription(schema);
  let field = `"${key}": ${type}`;
  if (desc) {
    field += ` // ${desc}`;
  }
  return field;
}
function describeZodType(schema) {
  if (schema instanceof z.ZodString) {
    const checks = schema._def.checks || [];
    const constraints = [];
    for (const check of checks) {
      if (check.kind === "email") constraints.push("email");
      if (check.kind === "url") constraints.push("url");
      if (check.kind === "uuid") constraints.push("uuid");
      if (check.kind === "min") constraints.push(`min: ${check.value}`);
      if (check.kind === "max") constraints.push(`max: ${check.value}`);
    }
    return constraints.length > 0 ? `string (${constraints.join(", ")})` : "string";
  }
  if (schema instanceof z.ZodNumber) {
    const checks = schema._def.checks || [];
    const constraints = [];
    for (const check of checks) {
      if (check.kind === "int") constraints.push("integer");
      if (check.kind === "min")
        constraints.push(`min: ${check.value}${check.inclusive ? "" : " (exclusive)"}`);
      if (check.kind === "max")
        constraints.push(`max: ${check.value}${check.inclusive ? "" : " (exclusive)"}`);
    }
    return constraints.length > 0 ? `number (${constraints.join(", ")})` : "number";
  }
  if (schema instanceof z.ZodBoolean) {
    return "boolean";
  }
  if (schema instanceof z.ZodArray) {
    const elementType = describeZodType(schema._def.type);
    return `array<${elementType}>`;
  }
  if (schema instanceof z.ZodEnum) {
    const values = schema._def.values;
    return `enum (${values.join(" | ")})`;
  }
  if (schema instanceof z.ZodLiteral) {
    const value = schema._def.value;
    return typeof value === "string" ? `"${value}"` : String(value);
  }
  if (schema instanceof z.ZodUnion) {
    const options = schema._def.options;
    return options.map((opt) => describeZodType(opt)).join(" | ");
  }
  if (schema instanceof z.ZodOptional) {
    const innerType = describeZodType(schema._def.innerType);
    return `${innerType} (optional)`;
  }
  if (schema instanceof z.ZodNullable) {
    const innerType = describeZodType(schema._def.innerType);
    return `${innerType} | null`;
  }
  if (schema instanceof z.ZodObject) {
    return "object {...}";
  }
  return "unknown";
}
function getZodDescription(schema) {
  return schema._def.description;
}
var CommonSchemas = {
  /**
   * Code review schema
   */
  codeReview: () => z.object({
    file: z.string().describe("File path"),
    review: z.number().min(1).max(10).describe("Quality score"),
    complexity: z.number().min(1).max(20).describe("Cyclomatic complexity"),
    maintainability: z.number().min(0).max(100).describe("Maintainability index"),
    issues: z.array(
      z.object({
        severity: z.enum(["low", "medium", "high"]),
        message: z.string(),
        line: z.number().optional()
      })
    ).describe("List of issues found"),
    suggestions: z.array(z.string()).describe("Improvement suggestions")
  }),
  /**
   * Agent statistics schema
   */
  agentStats: () => z.object({
    agentName: z.string().describe("Agent identifier"),
    status: z.enum(["idle", "busy"]).describe("Current status"),
    tasksCompleted: z.number().min(0).describe("Number of completed tasks"),
    currentTask: z.string().optional().describe("Current task ID"),
    uptime: z.number().min(0).describe("Uptime in milliseconds"),
    performance: z.object({
      avgDuration: z.number(),
      avgCost: z.number()
    }).describe("Performance metrics")
  }),
  /**
   * Task execution plan schema
   */
  taskPlan: () => z.object({
    taskId: z.string().describe("Task identifier"),
    steps: z.array(
      z.object({
        stepNumber: z.number(),
        description: z.string(),
        estimatedDuration: z.string()
      })
    ).describe("Execution steps"),
    total_estimated_duration: z.string().describe("Total estimated time"),
    risks: z.array(z.string()).describe("Potential risks")
  }),
  /**
   * Simple review (like structured-json)
   */
  simpleReview: () => z.object({
    review: z.number().min(1).max(10).describe("Quality score"),
    name: z.string().describe("Item name"),
    tags: z.array(z.string()).describe("Tags/categories")
  })
};
function validateWithZod(data, schema) {
  const result = schema.safeParse(data);
  if (result.success) {
    return {
      success: true,
      data: result.data
    };
  }
  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    issues: result.error.errors
  };
}
async function validateWithStandardSchema(data, schema) {
  if (!isStandardSchema(schema)) {
    return {
      success: false,
      error: "Provided schema does not implement Standard Schema",
      issues: []
    };
  }
  const result = await schema["~standard"].validate(data);
  if ("issues" in result && result.issues) {
    return {
      success: false,
      error: result.issues.map((issue) => issue.message).join("; "),
      issues: result.issues
    };
  }
  return {
    success: true,
    data: result.value
  };
}

export {
  isStandardSchema,
  zodSchemaToPrompt,
  CommonSchemas,
  validateWithZod,
  validateWithStandardSchema
};
