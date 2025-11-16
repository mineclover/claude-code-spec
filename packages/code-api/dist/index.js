"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/schema/zodSchemaBuilder.ts
var zodSchemaBuilder_exports = {};
__export(zodSchemaBuilder_exports, {
  CommonSchemas: () => CommonSchemas,
  isStandardSchema: () => isStandardSchema,
  validateWithStandardSchema: () => validateWithStandardSchema,
  validateWithZod: () => validateWithZod,
  zodSchemaToPrompt: () => zodSchemaToPrompt
});
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
  if (schema instanceof import_zod2.z.ZodObject) {
    const shape = schema.shape;
    const lines = ["{"];
    const entries = Object.entries(shape);
    entries.forEach(([key, fieldSchema], index) => {
      const isLast = index === entries.length - 1;
      const desc = describeZodField(key, fieldSchema);
      lines.push(`${ind}  ${desc}${isLast ? "" : ","}`);
    });
    lines.push(`${ind}}`);
    return lines.join("\n");
  }
  return describeZodType(schema);
}
function describeZodField(key, schema) {
  const type = describeZodType(schema);
  const desc = getZodDescription(schema);
  let field = `"${key}": ${type}`;
  if (desc) {
    field += ` // ${desc}`;
  }
  return field;
}
function describeZodType(schema) {
  if (schema instanceof import_zod2.z.ZodString) {
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
  if (schema instanceof import_zod2.z.ZodNumber) {
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
  if (schema instanceof import_zod2.z.ZodBoolean) {
    return "boolean";
  }
  if (schema instanceof import_zod2.z.ZodArray) {
    const elementType = describeZodType(schema._def.type);
    return `array<${elementType}>`;
  }
  if (schema instanceof import_zod2.z.ZodEnum) {
    const values = schema._def.values;
    return `enum (${values.join(" | ")})`;
  }
  if (schema instanceof import_zod2.z.ZodLiteral) {
    const value = schema._def.value;
    return typeof value === "string" ? `"${value}"` : String(value);
  }
  if (schema instanceof import_zod2.z.ZodUnion) {
    const options = schema._def.options;
    return options.map((opt) => describeZodType(opt)).join(" | ");
  }
  if (schema instanceof import_zod2.z.ZodOptional) {
    const innerType = describeZodType(schema._def.innerType);
    return `${innerType} (optional)`;
  }
  if (schema instanceof import_zod2.z.ZodNullable) {
    const innerType = describeZodType(schema._def.innerType);
    return `${innerType} | null`;
  }
  if (schema instanceof import_zod2.z.ZodObject) {
    return "object {...}";
  }
  return "unknown";
}
function getZodDescription(schema) {
  return schema._def.description;
}
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
var import_zod2, CommonSchemas;
var init_zodSchemaBuilder = __esm({
  "src/schema/zodSchemaBuilder.ts"() {
    "use strict";
    import_zod2 = require("zod");
    CommonSchemas = {
      /**
       * Code review schema
       */
      codeReview: () => import_zod2.z.object({
        file: import_zod2.z.string().describe("File path"),
        review: import_zod2.z.number().min(1).max(10).describe("Quality score"),
        complexity: import_zod2.z.number().min(1).max(20).describe("Cyclomatic complexity"),
        maintainability: import_zod2.z.number().min(0).max(100).describe("Maintainability index"),
        issues: import_zod2.z.array(
          import_zod2.z.object({
            severity: import_zod2.z.enum(["low", "medium", "high"]),
            message: import_zod2.z.string(),
            line: import_zod2.z.number().optional()
          })
        ).describe("List of issues found"),
        suggestions: import_zod2.z.array(import_zod2.z.string()).describe("Improvement suggestions")
      }),
      /**
       * Agent statistics schema
       */
      agentStats: () => import_zod2.z.object({
        agentName: import_zod2.z.string().describe("Agent identifier"),
        status: import_zod2.z.enum(["idle", "busy"]).describe("Current status"),
        tasksCompleted: import_zod2.z.number().min(0).describe("Number of completed tasks"),
        currentTask: import_zod2.z.string().optional().describe("Current task ID"),
        uptime: import_zod2.z.number().min(0).describe("Uptime in milliseconds"),
        performance: import_zod2.z.object({
          avgDuration: import_zod2.z.number(),
          avgCost: import_zod2.z.number()
        }).describe("Performance metrics")
      }),
      /**
       * Task execution plan schema
       */
      taskPlan: () => import_zod2.z.object({
        taskId: import_zod2.z.string().describe("Task identifier"),
        steps: import_zod2.z.array(
          import_zod2.z.object({
            stepNumber: import_zod2.z.number(),
            description: import_zod2.z.string(),
            estimatedDuration: import_zod2.z.string()
          })
        ).describe("Execution steps"),
        total_estimated_duration: import_zod2.z.string().describe("Total estimated time"),
        risks: import_zod2.z.array(import_zod2.z.string()).describe("Potential risks")
      }),
      /**
       * Simple review (like structured-json)
       */
      simpleReview: () => import_zod2.z.object({
        review: import_zod2.z.number().min(1).max(10).describe("Quality score"),
        name: import_zod2.z.string().describe("Item name"),
        tags: import_zod2.z.array(import_zod2.z.string()).describe("Tags/categories")
      })
    };
  }
});

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ClaudeClient: () => ClaudeClient,
  ClaudeQueryAPI: () => ClaudeQueryAPI,
  CommonSchemas: () => CommonSchemas,
  EntryPointExecutor: () => EntryPointExecutor,
  EntryPointManager: () => EntryPointManager,
  ExecutionNotFoundError: () => ExecutionNotFoundError,
  MaxConcurrentError: () => MaxConcurrentError,
  ProcessKillError: () => ProcessKillError,
  ProcessManager: () => ProcessManager,
  ProcessStartError: () => ProcessStartError,
  SchemaManager: () => SchemaManager,
  SessionManager: () => SessionManager,
  StreamParser: () => StreamParser,
  ValidationError: () => ValidationError,
  buildSchemaPrompt: () => buildSchemaPrompt,
  extractAndValidate: () => extractAndValidate,
  extractJSON: () => extractJSON,
  extractSessionId: () => extractSessionId,
  extractTextFromMessage: () => extractTextFromMessage,
  extractToolUsesFromMessage: () => extractToolUsesFromMessage,
  isAssistantEvent: () => isAssistantEvent,
  isErrorEvent: () => isErrorEvent,
  isResultEvent: () => isResultEvent,
  isSystemInitEvent: () => isSystemInitEvent,
  isUserEvent: () => isUserEvent,
  processManager: () => processManager,
  validateAgainstSchema: () => validateAgainstSchema,
  validateWithStandardSchema: () => validateWithStandardSchema,
  validateWithZod: () => validateWithZod,
  zodSchemaToPrompt: () => zodSchemaToPrompt
});
module.exports = __toCommonJS(index_exports);

// src/client/ClaudeClient.ts
var import_node_child_process = require("child_process");

// src/parser/schemas.ts
var import_zod = require("zod");
var BaseStreamEventSchema = import_zod.z.object({
  type: import_zod.z.string(),
  isSidechain: import_zod.z.boolean().optional()
});
var SystemInitEventSchema = import_zod.z.object({
  type: import_zod.z.literal("system"),
  subtype: import_zod.z.literal("init"),
  cwd: import_zod.z.string(),
  session_id: import_zod.z.string(),
  tools: import_zod.z.array(import_zod.z.string()),
  mcp_servers: import_zod.z.array(
    import_zod.z.object({
      name: import_zod.z.string(),
      status: import_zod.z.string()
    })
  ),
  model: import_zod.z.string(),
  permissionMode: import_zod.z.string(),
  slash_commands: import_zod.z.array(import_zod.z.string()),
  apiKeySource: import_zod.z.string(),
  output_style: import_zod.z.string(),
  agents: import_zod.z.array(import_zod.z.string()),
  uuid: import_zod.z.string(),
  isSidechain: import_zod.z.boolean().optional()
});
var ToolResultContentSchema = import_zod.z.object({
  type: import_zod.z.literal("tool_result"),
  tool_use_id: import_zod.z.string(),
  content: import_zod.z.string()
});
var UserMessageSchema = import_zod.z.object({
  role: import_zod.z.literal("user"),
  content: import_zod.z.union([import_zod.z.string(), import_zod.z.array(ToolResultContentSchema)])
});
var UserEventSchema = import_zod.z.object({
  type: import_zod.z.literal("user"),
  message: UserMessageSchema,
  session_id: import_zod.z.string(),
  parent_tool_use_id: import_zod.z.string().nullable(),
  uuid: import_zod.z.string(),
  isSidechain: import_zod.z.boolean().optional()
});
var TextContentSchema = import_zod.z.object({
  type: import_zod.z.literal("text"),
  text: import_zod.z.string()
});
var ToolUseContentSchema = import_zod.z.object({
  type: import_zod.z.literal("tool_use"),
  id: import_zod.z.string(),
  name: import_zod.z.string(),
  input: import_zod.z.record(import_zod.z.unknown())
});
var MessageContentSchema = import_zod.z.union([TextContentSchema, ToolUseContentSchema]);
var AssistantMessageSchema = import_zod.z.object({
  id: import_zod.z.string(),
  type: import_zod.z.literal("message"),
  role: import_zod.z.literal("assistant"),
  model: import_zod.z.string(),
  content: import_zod.z.array(MessageContentSchema),
  stop_reason: import_zod.z.string().nullable(),
  stop_sequence: import_zod.z.string().nullable(),
  usage: import_zod.z.object({
    input_tokens: import_zod.z.number(),
    cache_creation_input_tokens: import_zod.z.number().optional(),
    cache_read_input_tokens: import_zod.z.number().optional(),
    cache_creation: import_zod.z.object({
      ephemeral_5m_input_tokens: import_zod.z.number(),
      ephemeral_1h_input_tokens: import_zod.z.number()
    }).optional(),
    output_tokens: import_zod.z.number(),
    service_tier: import_zod.z.string()
  })
});
var AssistantEventSchema = import_zod.z.object({
  type: import_zod.z.literal("assistant"),
  message: AssistantMessageSchema,
  parent_tool_use_id: import_zod.z.string().nullable(),
  session_id: import_zod.z.string(),
  uuid: import_zod.z.string(),
  isSidechain: import_zod.z.boolean().optional()
});
var ModelUsageSchema = import_zod.z.object({
  inputTokens: import_zod.z.number(),
  outputTokens: import_zod.z.number(),
  cacheReadInputTokens: import_zod.z.number(),
  cacheCreationInputTokens: import_zod.z.number(),
  webSearchRequests: import_zod.z.number(),
  costUSD: import_zod.z.number(),
  contextWindow: import_zod.z.number()
});
var ResultEventSchema = import_zod.z.object({
  type: import_zod.z.literal("result"),
  subtype: import_zod.z.union([import_zod.z.literal("success"), import_zod.z.literal("error")]),
  is_error: import_zod.z.boolean(),
  duration_ms: import_zod.z.number(),
  duration_api_ms: import_zod.z.number(),
  num_turns: import_zod.z.number(),
  result: import_zod.z.string(),
  session_id: import_zod.z.string(),
  total_cost_usd: import_zod.z.number(),
  usage: import_zod.z.object({
    input_tokens: import_zod.z.number(),
    cache_creation_input_tokens: import_zod.z.number().optional(),
    cache_read_input_tokens: import_zod.z.number().optional(),
    output_tokens: import_zod.z.number(),
    server_tool_use: import_zod.z.object({
      web_search_requests: import_zod.z.number()
    }).optional(),
    service_tier: import_zod.z.string(),
    cache_creation: import_zod.z.object({
      ephemeral_1h_input_tokens: import_zod.z.number(),
      ephemeral_5m_input_tokens: import_zod.z.number()
    }).optional()
  }),
  modelUsage: import_zod.z.record(ModelUsageSchema),
  permission_denials: import_zod.z.array(
    import_zod.z.object({
      tool_name: import_zod.z.string(),
      tool_input: import_zod.z.record(import_zod.z.unknown())
    })
  ),
  uuid: import_zod.z.string(),
  isSidechain: import_zod.z.boolean().optional()
});
var ErrorEventSchema = import_zod.z.object({
  type: import_zod.z.literal("error"),
  error: import_zod.z.object({
    type: import_zod.z.string(),
    message: import_zod.z.string()
  }),
  isSidechain: import_zod.z.boolean().optional()
});
var StreamEventSchema = import_zod.z.union([
  SystemInitEventSchema,
  UserEventSchema,
  AssistantEventSchema,
  ResultEventSchema,
  ErrorEventSchema,
  BaseStreamEventSchema
  // Fallback for unknown event types
]);
function safeValidateStreamEvent(data) {
  const result = StreamEventSchema.safeParse(data);
  return result.success ? result.data : null;
}

// src/parser/StreamParser.ts
function createAnsiEscapeRegex() {
  const esc = String.fromCharCode(27);
  return new RegExp(`${esc}\\[[0-9;?]*[a-zA-Z]|${esc}\\)[a-zA-Z]`, "g");
}
var StreamParser = class {
  constructor(onEvent, onError) {
    this.buffer = "";
    this.onEvent = onEvent;
    this.onError = onError;
  }
  /**
   * Process incoming data chunk from stdout
   */
  processChunk(chunk) {
    const data = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    this.buffer += data;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      const cleanedLine = trimmedLine.replace(createAnsiEscapeRegex(), "");
      if (cleanedLine.startsWith("{") || cleanedLine.startsWith("[")) {
        this.parseLine(cleanedLine);
      } else if (cleanedLine) {
        console.log("[StreamParser] Non-JSON output:", cleanedLine);
      }
    }
  }
  /**
   * Parse a single line as JSON with runtime validation
   */
  parseLine(line) {
    try {
      const parsed = JSON.parse(line);
      const validated = safeValidateStreamEvent(parsed);
      if (!validated) {
        console.error("[StreamParser] Schema validation failed:", {
          line: line.substring(0, 100),
          parsed
        });
        if (this.onError) {
          this.onError(`Schema validation failed: ${line.substring(0, 100)}`);
        }
        return;
      }
      this.onEvent(validated);
    } catch (error) {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/]/g) || []).length;
      if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
        console.warn(
          "[StreamParser] Incomplete JSON detected (possible chunking issue):",
          line.substring(0, 100)
        );
        console.warn(
          `[StreamParser] Braces: ${openBraces} open, ${closeBraces} close | Brackets: ${openBrackets} open, ${closeBrackets} close`
        );
      } else {
        const errorMsg = `Failed to parse JSON: ${line.substring(0, 100)}`;
        console.error("[StreamParser]", errorMsg, error);
      }
      if (this.onError) {
        this.onError(`JSON parse error: ${line.substring(0, 100)}`);
      }
    }
  }
  /**
   * Flush any remaining data in buffer (call on stream end)
   */
  flush() {
    if (this.buffer.trim()) {
      this.parseLine(this.buffer);
      this.buffer = "";
    }
  }
  /**
   * Reset parser state
   */
  reset() {
    this.buffer = "";
  }
};

// src/parser/types.ts
function isSystemInitEvent(event) {
  return event.type === "system" && "subtype" in event && event.subtype === "init";
}
function isUserEvent(event) {
  return event.type === "user" && "message" in event;
}
function isAssistantEvent(event) {
  return event.type === "assistant" && "message" in event;
}
function isResultEvent(event) {
  return event.type === "result" && "result" in event;
}
function isErrorEvent(event) {
  return event.type === "error" && "error" in event;
}
function extractTextFromMessage(message) {
  return message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
}
function extractToolUsesFromMessage(message) {
  return message.content.filter((block) => block.type === "tool_use");
}
function extractSessionId(event) {
  if ("session_id" in event && typeof event.session_id === "string") {
    return event.session_id;
  }
  return null;
}

// src/client/ClaudeClient.ts
var ClaudeClient = class {
  constructor(options) {
    this.process = null;
    this.currentSessionId = null;
    this.options = options;
    this.currentSessionId = options.sessionId || null;
    this.parser = new StreamParser((event) => this.handleStreamEvent(event), options.onError);
  }
  /**
   * Execute a query with Claude CLI
   */
  execute(query) {
    if (this.process) {
      throw new Error("Client already has an active process");
    }
    console.log("[ClaudeClient] Executing query:", {
      cwd: this.options.cwd,
      query: `${query.substring(0, 50)}...`,
      sessionId: this.currentSessionId
    });
    const args = [
      "-p",
      query,
      "--output-format",
      "stream-json",
      "--verbose",
      "--dangerously-skip-permissions"
    ];
    if (this.options.mcpConfig) {
      args.push("--mcp-config", this.options.mcpConfig);
      args.push("--strict-mcp-config");
    }
    if (this.options.model) {
      args.push("--model", this.options.model);
    } else {
      args.push("--model", "sonnet");
    }
    if (this.currentSessionId) {
      args.push("--resume", this.currentSessionId);
    }
    console.log("[ClaudeClient] Args:", args);
    this.process = (0, import_node_child_process.spawn)("claude", args, {
      cwd: this.options.cwd,
      env: {
        ...process.env,
        PATH: process.env.PATH
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.setupProcessHandlers();
    return this.process;
  }
  /**
   * Setup stdout, stderr, and close handlers
   */
  setupProcessHandlers() {
    if (!this.process) return;
    this.process.stdout?.on("data", (chunk) => {
      this.parser.processChunk(chunk);
    });
    this.process.stderr?.on("data", (chunk) => {
      const errorMsg = chunk.toString("utf8");
      console.error("[ClaudeClient] stderr:", errorMsg);
      if (this.options.onError) {
        this.options.onError(errorMsg);
      }
    });
    this.process.on("close", (code) => {
      console.log("[ClaudeClient] Process closed:", code);
      this.parser.flush();
      this.cleanup();
      if (this.options.onClose) {
        this.options.onClose(code || 0);
      }
    });
    this.process.on("error", (error) => {
      console.error("[ClaudeClient] Process error:", error);
      if (this.options.onError) {
        this.options.onError(`Process error: ${error.message}`);
      }
      this.cleanup();
    });
  }
  /**
   * Handle parsed stream events
   */
  handleStreamEvent(event) {
    if (isSystemInitEvent(event)) {
      this.currentSessionId = event.session_id;
      console.log("[ClaudeClient] Session ID:", this.currentSessionId);
    }
    this.options.onStream(event);
  }
  /**
   * Get current session ID
   */
  getSessionId() {
    return this.currentSessionId;
  }
  /**
   * Kill the running process
   */
  kill() {
    if (this.process) {
      this.process.kill();
      this.cleanup();
    }
  }
  /**
   * Cleanup internal state
   */
  cleanup() {
    this.process = null;
    this.parser.reset();
  }
  /**
   * Check if process is running
   */
  isRunning() {
    return this.process !== null && !this.process.killed;
  }
};

// src/query/ClaudeQueryAPI.ts
var import_node_child_process2 = require("child_process");

// src/schema/jsonExtractor.ts
function extractJSON(text) {
  if (!text || text.trim() === "") {
    return {
      success: false,
      error: "Empty input text",
      raw: text
    };
  }
  const cleaned = removeMarkdownCodeBlocks(text);
  const directParse = tryParse(cleaned);
  if (directParse.success) {
    return {
      success: true,
      data: directParse.data,
      raw: text,
      cleanedText: cleaned
    };
  }
  const extracted = extractJSONFromMixedContent(cleaned);
  if (extracted) {
    const extractedParse = tryParse(extracted);
    if (extractedParse.success) {
      return {
        success: true,
        data: extractedParse.data,
        raw: text,
        cleanedText: extracted
      };
    }
  }
  const fixed = tryCommonFixes(cleaned);
  if (fixed) {
    const fixedParse = tryParse(fixed);
    if (fixedParse.success) {
      return {
        success: true,
        data: fixedParse.data,
        raw: text,
        cleanedText: fixed
      };
    }
  }
  return {
    success: false,
    error: directParse.error || "Could not extract valid JSON",
    raw: text,
    cleanedText: cleaned
  };
}
function removeMarkdownCodeBlocks(text) {
  text = text.replace(/```json\s*\n?([\s\S]*?)```/g, "$1");
  text = text.replace(/```\s*\n?([\s\S]*?)```/g, "$1");
  return text.trim();
}
function tryParse(text) {
  try {
    const data = JSON.parse(text);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
function extractJSONFromMixedContent(text) {
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }
  return null;
}
function tryCommonFixes(text) {
  let fixed = text;
  fixed = fixed.replace(/,(\s*[}\]])/g, "$1");
  fixed = fixed.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  if (fixed !== text) {
    return fixed;
  }
  return null;
}
function validateJSONStructure(data, requiredFields) {
  if (!data || typeof data !== "object") {
    return false;
  }
  const obj = data;
  for (const field of requiredFields) {
    if (!(field in obj)) {
      return false;
    }
  }
  return true;
}
function extractAndValidate(text, requiredFields) {
  const result = extractJSON(text);
  if (!result.success || !result.data) {
    return result;
  }
  if (!validateJSONStructure(result.data, requiredFields)) {
    return {
      success: false,
      error: `JSON missing required fields: ${requiredFields.join(", ")}`,
      raw: text,
      cleanedText: result.cleanedText
    };
  }
  return result;
}

// src/schema/schemaBuilder.ts
function buildSchemaPrompt(schema, instruction) {
  const sections = [];
  if (instruction) {
    sections.push(instruction);
    sections.push("");
  }
  sections.push("Respond with JSON matching this exact schema:");
  sections.push("");
  sections.push("```");
  sections.push("{");
  const fields = Object.entries(schema);
  fields.forEach(([key, field], index) => {
    const isLast = index === fields.length - 1;
    const line = buildFieldLine(key, field, isLast);
    sections.push(`  ${line}`);
  });
  sections.push("}");
  sections.push("```");
  sections.push("");
  sections.push("**Important:**");
  sections.push("- Output ONLY the JSON, no explanations");
  sections.push("- Do NOT use markdown code blocks in your response");
  sections.push("- Ensure all required fields are present");
  sections.push("- Match types exactly");
  return sections.join("\n");
}
function buildFieldLine(key, field, isLast) {
  const parts = [];
  parts.push(`"${key}":`);
  if (field.type === "array" && field.arrayItemType) {
    parts.push(`array<${field.arrayItemType}>`);
  } else if (field.type === "object" && field.objectSchema) {
    parts.push("object {...}");
  } else {
    parts.push(field.type);
  }
  const constraints = [];
  if (field.enum) {
    constraints.push(`enum: ${field.enum.join("|")}`);
  }
  if (field.min !== void 0 || field.max !== void 0) {
    if (field.min !== void 0 && field.max !== void 0) {
      constraints.push(`range: ${field.min}-${field.max}`);
    } else if (field.min !== void 0) {
      constraints.push(`min: ${field.min}`);
    } else if (field.max !== void 0) {
      constraints.push(`max: ${field.max}`);
    }
  }
  if (field.required === false) {
    constraints.push("optional");
  }
  if (constraints.length > 0) {
    parts.push(`(${constraints.join(", ")})`);
  }
  if (field.description) {
    parts.push(`// ${field.description}`);
  }
  if (!isLast) {
    parts[parts.length - 1] += ",";
  }
  return parts.join(" ");
}
function validateAgainstSchema(data, schema) {
  const errors = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data is not an object"] };
  }
  const obj = data;
  for (const [key, field] of Object.entries(schema)) {
    if (field.required !== false && !(key in obj)) {
      errors.push(`Missing required field: ${key}`);
    }
    if (key in obj) {
      const value = obj[key];
      if (!checkType(value, field.type)) {
        errors.push(`Invalid type for ${key}: expected ${field.type}, got ${typeof value}`);
      }
      if (field.enum && !field.enum.includes(value)) {
        errors.push(`Invalid value for ${key}: must be one of ${field.enum.join(", ")}`);
      }
      if (typeof value === "number") {
        if (field.min !== void 0 && value < field.min) {
          errors.push(`Value for ${key} is below minimum: ${value} < ${field.min}`);
        }
        if (field.max !== void 0 && value > field.max) {
          errors.push(`Value for ${key} exceeds maximum: ${value} > ${field.max}`);
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
function checkType(value, type) {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "null":
      return value === null;
    default:
      return false;
  }
}

// src/query/ClaudeQueryAPI.ts
var ClaudeQueryAPI = class {
  constructor() {
    this.runningProcess = null;
  }
  /**
   * Execute a query with output-style and get clean results
   */
  async query(projectPath, query, options = {}) {
    const { outputStyle, model, mcpConfig, filterThinking = true, timeout = 12e4 } = options;
    console.info("Executing query with ClaudeQueryAPI", {
      module: "ClaudeQueryAPI",
      projectPath,
      outputStyle,
      model,
      filterThinking
    });
    const enhancedQuery = this.buildQuery(query, outputStyle);
    const events = await this.executeClaudeProcess(projectPath, enhancedQuery, {
      model,
      mcpConfig,
      timeout
    });
    const processedEvents = filterThinking ? this.filterThinkingBlocks(events) : events;
    const result = this.extractResult(processedEvents);
    const messages = this.extractMessages(processedEvents);
    const metadata = this.extractMetadata(events);
    if (outputStyle) {
      metadata.outputStyle = outputStyle;
    }
    return {
      result,
      messages,
      events: processedEvents,
      metadata
    };
  }
  /**
   * Build query with output-style injection
   */
  buildQuery(query, outputStyle) {
    if (!outputStyle) {
      return query;
    }
    return `/output-style ${outputStyle}

${query}`;
  }
  /**
   * Execute Claude process and collect events
   */
  async executeClaudeProcess(projectPath, query, options) {
    return new Promise((resolve, reject) => {
      const events = [];
      const { model, mcpConfig, timeout = 12e4 } = options;
      const args = ["-p", query, "--output-format", "stream-json", "--verbose"];
      if (model) {
        args.push("--model", model);
      }
      if (mcpConfig) {
        args.push("--mcp-config", mcpConfig);
        args.push("--strict-mcp-config");
      }
      console.debug("Spawning Claude process", {
        module: "ClaudeQueryAPI",
        args,
        cwd: projectPath
      });
      const child = (0, import_node_child_process2.spawn)("claude", args, {
        cwd: projectPath,
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: "0"
        }
      });
      this.runningProcess = child;
      let buffer = "";
      let timeoutHandle = null;
      if (timeout > 0) {
        timeoutHandle = setTimeout(() => {
          console.warn("Query timeout, killing process", {
            module: "ClaudeQueryAPI",
            timeout
          });
          child.kill("SIGTERM");
          reject(new Error(`Query timeout after ${timeout}ms`));
        }, timeout);
      }
      child.stdout.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            events.push(event);
          } catch (_error) {
            console.debug("Failed to parse stream line", {
              module: "ClaudeQueryAPI",
              line: line.substring(0, 100)
            });
          }
        }
      });
      child.stderr.on("data", (data) => {
        console.debug("Claude stderr", {
          module: "ClaudeQueryAPI",
          data: data.toString()
        });
      });
      child.on("close", (code) => {
        this.runningProcess = null;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (code === 0) {
          console.info("Query completed successfully", {
            module: "ClaudeQueryAPI",
            eventsCount: events.length
          });
          resolve(events);
        } else {
          console.error("Query failed", void 0, {
            module: "ClaudeQueryAPI",
            code
          });
          reject(new Error(`Process exited with code ${code}`));
        }
      });
      child.on("error", (error) => {
        this.runningProcess = null;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        console.error("Process error", error, {
          module: "ClaudeQueryAPI"
        });
        reject(error);
      });
    });
  }
  /**
   * Filter thinking blocks from events
   */
  filterThinkingBlocks(events) {
    return events.map((event) => {
      if (event.type === "message" && event.message?.content) {
        return {
          ...event,
          message: {
            ...event.message,
            content: event.message.content.filter((block) => block.type !== "thinking")
          }
        };
      }
      return event;
    });
  }
  /**
   * Extract final result from events
   */
  extractResult(events) {
    const resultEvent = events.find((e) => e.type === "result");
    return resultEvent?.result || "";
  }
  /**
   * Extract all assistant messages
   */
  extractMessages(events) {
    const messages = [];
    for (const event of events) {
      if (event.type === "message" && event.subtype === "assistant") {
        const content = event.message?.content || [];
        for (const block of content) {
          if (block.type === "text") {
            messages.push(block.text);
          }
        }
      }
    }
    return messages;
  }
  /**
   * Extract execution metadata
   */
  extractMetadata(events) {
    const resultEvent = events.find((e) => e.type === "result");
    return {
      totalCost: resultEvent?.total_cost_usd || 0,
      durationMs: resultEvent?.duration_ms || 0,
      numTurns: resultEvent?.num_turns || 0
    };
  }
  /**
   * Execute query and extract JSON result
   *
   * Automatically:
   * - Uses 'structured-json' output-style
   * - Filters thinking blocks
   * - Extracts and validates JSON
   */
  async queryJSON(projectPath, query, options = {}) {
    const { requiredFields, ...queryOptions } = options;
    console.info("Executing JSON query", {
      module: "ClaudeQueryAPI",
      projectPath,
      requiredFields: requiredFields?.length || 0
    });
    try {
      const result = await this.query(projectPath, query, {
        ...queryOptions,
        outputStyle: "structured-json",
        filterThinking: true
      });
      if (requiredFields && requiredFields.length > 0) {
        return extractAndValidate(
          result.result,
          requiredFields
        );
      } else {
        return extractJSON(result.result);
      }
    } catch (error) {
      console.error("JSON query failed", error instanceof Error ? error : void 0, {
        module: "ClaudeQueryAPI"
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  /**
   * Execute query and get typed JSON result with validation
   */
  async queryTypedJSON(projectPath, query, requiredFields, options = {}) {
    return this.queryJSON(projectPath, query, {
      ...options,
      requiredFields
    });
  }
  /**
   * Execute query with explicit JSON schema
   *
   * Automatically injects schema into prompt and validates response
   */
  async queryWithSchema(projectPath, instruction, schema, options = {}) {
    console.info("Executing query with schema", {
      module: "ClaudeQueryAPI",
      projectPath,
      schemaFields: Object.keys(schema).length
    });
    try {
      const schemaPrompt = buildSchemaPrompt(schema, instruction);
      console.debug("Built schema prompt", {
        module: "ClaudeQueryAPI",
        promptLength: schemaPrompt.length
      });
      const result = await this.query(projectPath, schemaPrompt, {
        ...options,
        outputStyle: "json",
        filterThinking: true
      });
      const extracted = extractJSON(result.result);
      if (!extracted.success) {
        return extracted;
      }
      const validation = validateAgainstSchema(extracted.data, schema);
      if (!validation.valid) {
        console.warn("Schema validation failed", {
          module: "ClaudeQueryAPI",
          errors: validation.errors
        });
        return {
          success: false,
          error: `Schema validation failed: ${validation.errors.join("; ")}`,
          raw: extracted.raw,
          cleanedText: extracted.cleanedText
        };
      }
      console.info("Schema query successful", {
        module: "ClaudeQueryAPI",
        dataKeys: extracted.data ? Object.keys(extracted.data).length : 0
      });
      return extracted;
    } catch (error) {
      console.error("Schema query failed", error instanceof Error ? error : void 0, {
        module: "ClaudeQueryAPI"
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  /**
   * Kill running process
   */
  kill() {
    if (this.runningProcess) {
      console.info("Killing running query process", {
        module: "ClaudeQueryAPI"
      });
      this.runningProcess.kill("SIGTERM");
      this.runningProcess = null;
    }
  }
  /**
   * Execute query with Zod schema validation (Standard Schema compliant)
   *
   * Output-style은 힌트 역할, 실제 검증은 Zod가 수행
   *
   * @example
   * ```typescript
   * import { z } from 'zod';
   *
   * const schema = z.object({
   *   file: z.string(),
   *   complexity: z.number().min(1).max(20)
   * });
   *
   * const result = await api.queryWithZod(
   *   projectPath,
   *   'Analyze src/main.ts',
   *   schema
   * );
   *
   * if (result.success) {
   *   console.log(result.data.file);
   * }
   * ```
   */
  async queryWithZod(projectPath, instruction, schema, options = {}) {
    const { zodSchemaToPrompt: zodSchemaToPrompt2, validateWithZod: validateWithZod2 } = await Promise.resolve().then(() => (init_zodSchemaBuilder(), zodSchemaBuilder_exports));
    console.info("Executing query with Zod schema", {
      module: "ClaudeQueryAPI",
      projectPath,
      schemaType: schema.constructor.name
    });
    try {
      const schemaPrompt = zodSchemaToPrompt2(schema, instruction);
      console.debug("Built Zod schema prompt", {
        module: "ClaudeQueryAPI",
        promptLength: schemaPrompt.length
      });
      const result = await this.query(projectPath, schemaPrompt, {
        ...options,
        outputStyle: "json",
        filterThinking: true
      });
      const extracted = extractJSON(result.result);
      if (!extracted.success) {
        return extracted;
      }
      const validation = validateWithZod2(extracted.data, schema);
      if (!validation.success) {
        console.warn("Zod validation failed", {
          module: "ClaudeQueryAPI",
          error: validation.error,
          issuesCount: validation.issues.length
        });
        return {
          success: false,
          error: `Schema validation failed: ${validation.error}`,
          raw: extracted.raw,
          cleanedText: extracted.cleanedText
        };
      }
      console.info("Zod validation successful", {
        module: "ClaudeQueryAPI",
        dataKeys: extracted.data ? Object.keys(extracted.data).length : 0
      });
      return {
        success: true,
        data: validation.data,
        raw: extracted.raw,
        cleanedText: extracted.cleanedText
      };
    } catch (error) {
      console.error("Zod query failed", error instanceof Error ? error : void 0, {
        module: "ClaudeQueryAPI"
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  /**
   * Execute query with Standard Schema validation
   *
   * Zod v3.24.0+ 스키마는 자동으로 Standard Schema를 구현합니다.
   *
   * @example
   * ```typescript
   * import { z } from 'zod';
   *
   * const schema = z.object({
   *   name: z.string(),
   *   age: z.number()
   * });
   *
   * const result = await api.queryWithStandardSchema(
   *   projectPath,
   *   'Get user info',
   *   schema
   * );
   * ```
   */
  async queryWithStandardSchema(projectPath, instruction, schema, options = {}) {
    const { zodSchemaToPrompt: zodSchemaToPrompt2, validateWithStandardSchema: validateWithStandardSchema2, isStandardSchema: isStandardSchema2 } = await Promise.resolve().then(() => (init_zodSchemaBuilder(), zodSchemaBuilder_exports));
    console.info("Executing query with Standard Schema", {
      module: "ClaudeQueryAPI",
      projectPath
    });
    if (!isStandardSchema2(schema)) {
      return {
        success: false,
        error: "Provided schema does not implement Standard Schema V1"
      };
    }
    try {
      let schemaPrompt = instruction;
      if ("_def" in schema) {
        schemaPrompt = zodSchemaToPrompt2(schema, instruction);
      } else {
        schemaPrompt = `${instruction}

Respond with valid JSON.`;
      }
      const result = await this.query(projectPath, schemaPrompt, {
        ...options,
        outputStyle: "json",
        filterThinking: true
      });
      const extracted = extractJSON(result.result);
      if (!extracted.success) {
        return extracted;
      }
      const validation = await validateWithStandardSchema2(extracted.data, schema);
      if (!validation.success) {
        console.warn("Standard Schema validation failed", {
          module: "ClaudeQueryAPI",
          error: validation.error
        });
        return {
          success: false,
          error: `Schema validation failed: ${validation.error}`,
          raw: extracted.raw,
          cleanedText: extracted.cleanedText
        };
      }
      console.info("Standard Schema validation successful", {
        module: "ClaudeQueryAPI"
      });
      return {
        success: true,
        data: validation.data,
        raw: extracted.raw,
        cleanedText: extracted.cleanedText
      };
    } catch (error) {
      console.error("Standard Schema query failed", error instanceof Error ? error : void 0, {
        module: "ClaudeQueryAPI"
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

// src/entrypoint/EntryPointManager.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// src/entrypoint/SchemaManager.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var SchemaManager = class {
  constructor(projectPath) {
    this.cachedSchemas = /* @__PURE__ */ new Map();
    this.schemasDir = path.join(projectPath, "workflow", "schemas");
    this.ensureSchemasDir();
  }
  /**
   * 스키마 디렉토리 생성
   */
  ensureSchemasDir() {
    if (!fs.existsSync(this.schemasDir)) {
      fs.mkdirSync(this.schemasDir, { recursive: true });
    }
  }
  /**
   * 스키마 로드
   */
  loadSchema(schemaName) {
    if (this.cachedSchemas.has(schemaName)) {
      const cachedSchema = this.cachedSchemas.get(schemaName);
      if (cachedSchema) {
        return cachedSchema;
      }
    }
    const schemaPath = path.join(this.schemasDir, `${schemaName}.json`);
    if (!fs.existsSync(schemaPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(schemaPath, "utf-8");
      const schema = JSON.parse(content);
      this.cachedSchemas.set(schemaName, schema);
      return schema;
    } catch (error) {
      console.error(`Failed to load schema ${schemaName}:`, error);
      return null;
    }
  }
  /**
   * 스키마 저장
   */
  saveSchema(schema) {
    const schemaPath = path.join(this.schemasDir, `${schema.name}.json`);
    try {
      fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2), "utf-8");
      this.cachedSchemas.set(schema.name, schema);
      console.log(`Schema saved: ${schema.name}`);
    } catch (error) {
      console.error(`Failed to save schema ${schema.name}:`, error);
      throw error;
    }
  }
  /**
   * 모든 스키마 목록 조회
   */
  listSchemas() {
    if (!fs.existsSync(this.schemasDir)) {
      return [];
    }
    try {
      const files = fs.readdirSync(this.schemasDir);
      return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
    } catch (error) {
      console.error("Failed to list schemas:", error);
      return [];
    }
  }
  /**
   * 스키마 삭제
   */
  deleteSchema(schemaName) {
    const schemaPath = path.join(this.schemasDir, `${schemaName}.json`);
    if (!fs.existsSync(schemaPath)) {
      return false;
    }
    try {
      fs.unlinkSync(schemaPath);
      this.cachedSchemas.delete(schemaName);
      console.log(`Schema deleted: ${schemaName}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete schema ${schemaName}:`, error);
      return false;
    }
  }
  /**
   * 스키마 존재 여부 확인
   */
  schemaExists(schemaName) {
    const schemaPath = path.join(this.schemasDir, `${schemaName}.json`);
    return fs.existsSync(schemaPath);
  }
  /**
   * 캐시 초기화
   */
  clearCache() {
    this.cachedSchemas.clear();
  }
  /**
   * 스키마 디렉토리 경로 반환
   */
  getSchemasDir() {
    return this.schemasDir;
  }
};

// src/entrypoint/EntryPointManager.ts
var EntryPointManager = class {
  constructor(projectPath) {
    this.cachedConfig = null;
    this.projectPath = projectPath;
    this.configPath = path2.join(projectPath, "workflow", "entry-points.json");
    this.ensureConfigFile();
  }
  /**
   * 설정 파일 초기화
   */
  ensureConfigFile() {
    const workflowDir = path2.dirname(this.configPath);
    if (!fs2.existsSync(workflowDir)) {
      fs2.mkdirSync(workflowDir, { recursive: true });
    }
    if (!fs2.existsSync(this.configPath)) {
      const defaultConfig = {
        version: "1.0.0",
        entryPoints: {}
      };
      fs2.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2), "utf-8");
    }
  }
  /**
   * 설정 로드
   */
  loadConfig() {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }
    try {
      const content = fs2.readFileSync(this.configPath, "utf-8");
      this.cachedConfig = JSON.parse(content);
      return this.cachedConfig;
    } catch (error) {
      console.error("Failed to load entry points config:", error);
      return { version: "1.0.0", entryPoints: {} };
    }
  }
  /**
   * 설정 저장
   */
  saveConfig(config) {
    try {
      fs2.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
      this.cachedConfig = config;
    } catch (error) {
      console.error("Failed to save entry points config:", error);
      throw error;
    }
  }
  /**
   * 진입점 추가/업데이트
   */
  setEntryPoint(config) {
    const validation = this.validateEntryPoint(config);
    if (!validation.valid) {
      const errorMessage = `Entry point validation failed:
${validation.errors.join("\n")}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    if (validation.warnings.length > 0) {
      console.warn("Entry point validation warnings:");
      for (const warning of validation.warnings) {
        console.warn(`  - ${warning}`);
      }
    }
    const allConfig = this.loadConfig();
    allConfig.entryPoints[config.name] = config;
    this.saveConfig(allConfig);
    console.log(`Entry point saved: ${config.name}`);
  }
  /**
   * 진입점 조회
   */
  getEntryPoint(name) {
    const config = this.loadConfig();
    return config.entryPoints[name] || null;
  }
  /**
   * 진입점 상세 정보 조회 (스키마 포함)
   * 실행 전에 예상 출력 형식을 명확히 파악하기 위한 메서드
   */
  getEntryPointDetail(name) {
    const entryPoint = this.getEntryPoint(name);
    if (!entryPoint) {
      return null;
    }
    const schemaManager = new SchemaManager(this.projectPath);
    let schema;
    let fields;
    let examples;
    if (entryPoint.outputFormat.type === "structured") {
      const schemaName = entryPoint.outputFormat.schemaName || entryPoint.outputFormat.schema?.replace(".json", "");
      if (schemaName) {
        schema = schemaManager.loadSchema(schemaName);
        if (schema) {
          fields = schema.schema;
          examples = schema.examples;
        }
      }
    }
    let description;
    switch (entryPoint.outputFormat.type) {
      case "text":
        description = "\uC77C\uBC18 \uD14D\uC2A4\uD2B8 \uD615\uC2DD\uC758 \uC790\uC720\uB85C\uC6B4 \uC751\uB2F5";
        break;
      case "json":
        description = "JSON \uD615\uC2DD\uC758 \uAD6C\uC870\uD654\uB41C \uC751\uB2F5 (\uC2A4\uD0A4\uB9C8 \uAC80\uC99D \uC5C6\uC74C)";
        break;
      case "structured":
        description = schema ? `${schema.description} - JSON \uD615\uC2DD\uC758 \uC2A4\uD0A4\uB9C8 \uAC80\uC99D\uB41C \uC751\uB2F5` : "JSON \uD615\uC2DD\uC758 \uC2A4\uD0A4\uB9C8 \uAC80\uC99D\uB41C \uC751\uB2F5";
        break;
    }
    return {
      config: entryPoint,
      schema: schema || void 0,
      expectedOutput: {
        type: entryPoint.outputFormat.type,
        description,
        fields,
        examples
      }
    };
  }
  /**
   * 모든 진입점 조회
   */
  getAllEntryPoints() {
    const config = this.loadConfig();
    return config.entryPoints;
  }
  /**
   * 진입점 목록 조회
   */
  listEntryPoints() {
    const config = this.loadConfig();
    return Object.keys(config.entryPoints);
  }
  /**
   * 진입점 삭제
   */
  deleteEntryPoint(name) {
    const config = this.loadConfig();
    if (!config.entryPoints[name]) {
      return false;
    }
    delete config.entryPoints[name];
    this.saveConfig(config);
    console.log(`Entry point deleted: ${name}`);
    return true;
  }
  /**
   * 진입점 존재 여부 확인
   */
  entryPointExists(name) {
    const config = this.loadConfig();
    return !!config.entryPoints[name];
  }
  /**
   * 진입점 검증
   */
  validateEntryPoint(config) {
    const errors = [];
    const warnings = [];
    if (!config.name || config.name.trim() === "") {
      errors.push("Entry point name is required");
    }
    if (!config.description || config.description.trim() === "") {
      errors.push("Entry point description is required");
    }
    if (!config.outputFormat) {
      errors.push("Output format is required");
    }
    if (config.outputFormat) {
      if (!["text", "json", "structured"].includes(config.outputFormat.type)) {
        errors.push("Invalid output format type");
      }
      if (config.outputFormat.type === "structured" && !config.outputFormat.schema && !config.outputFormat.schemaName) {
        errors.push("Schema is required for structured output");
      }
      if (config.outputFormat.type === "structured") {
        const schemaName = config.outputFormat.schemaName || config.outputFormat.schema?.replace(".json", "");
        if (schemaName) {
          const schemaManager = new SchemaManager(this.projectPath);
          if (!schemaManager.schemaExists(schemaName)) {
            errors.push(
              `Schema '${schemaName}' does not exist in workflow/schemas/. Please create it first using SchemaManager.`
            );
          }
        }
      }
    }
    if (config.options) {
      if (config.options.model && !["sonnet", "opus", "haiku"].includes(config.options.model)) {
        errors.push("Invalid model name");
      }
      if (config.options.timeout && config.options.timeout < 1e3) {
        warnings.push("Timeout should be at least 1000ms");
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  /**
   * 태그로 진입점 필터링
   */
  filterByTag(tag) {
    const config = this.loadConfig();
    return Object.values(config.entryPoints).filter((ep) => ep.tags?.includes(tag));
  }
  /**
   * 진입점 검색
   */
  searchEntryPoints(query) {
    const config = this.loadConfig();
    const lowerQuery = query.toLowerCase();
    return Object.values(config.entryPoints).filter(
      (ep) => ep.name.toLowerCase().includes(lowerQuery) || ep.description.toLowerCase().includes(lowerQuery) || ep.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }
  /**
   * 캐시 초기화
   */
  clearCache() {
    this.cachedConfig = null;
  }
  /**
   * 설정 파일 경로 반환
   */
  getConfigPath() {
    return this.configPath;
  }
};

// src/entrypoint/EntryPointExecutor.ts
var EntryPointExecutor = class {
  constructor(projectPath) {
    this.entryPointManager = new EntryPointManager(projectPath);
    this.schemaManager = new SchemaManager(projectPath);
    this.queryAPI = new ClaudeQueryAPI();
  }
  /**
   * 진입점을 통해 쿼리 실행
   */
  async execute(params) {
    const startTime = Date.now();
    try {
      const entryPoint = this.entryPointManager.getEntryPoint(params.entryPoint);
      if (!entryPoint) {
        return {
          success: false,
          error: `Entry point not found: ${params.entryPoint}`,
          metadata: {
            entryPoint: params.entryPoint,
            duration: Date.now() - startTime,
            model: "unknown"
          }
        };
      }
      console.log(`
[EntryPoint: ${entryPoint.name}]`);
      console.log(`Description: ${entryPoint.description}`);
      console.log(`Output Format: ${entryPoint.outputFormat.type}`);
      const model = params.options?.model || entryPoint.options?.model;
      const mcpConfig = params.options?.mcpConfig || entryPoint.options?.mcpConfig;
      const timeout = params.options?.timeout || entryPoint.options?.timeout;
      const filterThinking = entryPoint.options?.filterThinking ?? true;
      let result;
      switch (entryPoint.outputFormat.type) {
        case "structured":
          result = await this.executeStructured(params, entryPoint, {
            model,
            mcpConfig,
            timeout,
            filterThinking
          });
          break;
        case "json":
          result = await this.executeJSON(params, entryPoint, {
            model,
            mcpConfig,
            timeout,
            filterThinking
          });
          break;
        default:
          result = await this.executeText(params, entryPoint, {
            model,
            mcpConfig,
            timeout,
            filterThinking
          });
          break;
      }
      result.metadata.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          entryPoint: params.entryPoint,
          duration: Date.now() - startTime,
          model: "unknown"
        }
      };
    }
  }
  /**
   * Structured 형식으로 실행 (스키마 검증)
   */
  async executeStructured(params, entryPoint, options) {
    const schemaName = entryPoint.outputFormat.schemaName || entryPoint.outputFormat.schema?.replace(".json", "");
    if (!schemaName) {
      return {
        success: false,
        error: "Schema not specified",
        metadata: {
          entryPoint: params.entryPoint,
          duration: 0,
          model: options.model || "sonnet"
        }
      };
    }
    const schemaDefinition = this.schemaManager.loadSchema(schemaName);
    if (!schemaDefinition) {
      return {
        success: false,
        error: `Schema not found: ${schemaName}`,
        metadata: {
          entryPoint: params.entryPoint,
          duration: 0,
          model: options.model || "sonnet"
        }
      };
    }
    console.log(`Using schema: ${schemaDefinition.name}`);
    const schemaPrompt = buildSchemaPrompt(schemaDefinition.schema, params.query);
    const queryResult = await this.queryAPI.query(params.projectPath, schemaPrompt, {
      outputStyle: entryPoint.outputStyle,
      model: options.model,
      mcpConfig: options.mcpConfig,
      timeout: options.timeout,
      filterThinking: options.filterThinking
    });
    const extracted = extractJSON(queryResult.result);
    if (!extracted.success) {
      return {
        success: false,
        error: extracted.error,
        rawResult: queryResult.result,
        metadata: {
          entryPoint: params.entryPoint,
          duration: queryResult.metadata.durationMs,
          model: options.model || "sonnet"
        }
      };
    }
    const validation = validateAgainstSchema(extracted.data, schemaDefinition.schema);
    if (!validation.valid) {
      console.warn("Schema validation warnings:", validation.errors);
    }
    return {
      success: true,
      data: extracted.data,
      rawResult: queryResult.result,
      metadata: {
        entryPoint: params.entryPoint,
        duration: queryResult.metadata.durationMs,
        model: options.model || "sonnet"
      }
    };
  }
  /**
   * JSON 형식으로 실행 (스키마 없음)
   */
  async executeJSON(params, entryPoint, options) {
    const enhancedQuery = `${params.query}

Respond with valid JSON only.`;
    const queryResult = await this.queryAPI.query(params.projectPath, enhancedQuery, {
      outputStyle: entryPoint.outputStyle || "json",
      model: options.model,
      mcpConfig: options.mcpConfig,
      timeout: options.timeout,
      filterThinking: options.filterThinking
    });
    const extracted = extractJSON(queryResult.result);
    if (!extracted.success) {
      return {
        success: false,
        error: extracted.error,
        rawResult: queryResult.result,
        metadata: {
          entryPoint: params.entryPoint,
          duration: queryResult.metadata.durationMs,
          model: options.model || "sonnet"
        }
      };
    }
    return {
      success: true,
      data: extracted.data,
      rawResult: queryResult.result,
      metadata: {
        entryPoint: params.entryPoint,
        duration: queryResult.metadata.durationMs,
        model: options.model || "sonnet"
      }
    };
  }
  /**
   * Text 형식으로 실행
   */
  async executeText(params, entryPoint, options) {
    const queryResult = await this.queryAPI.query(params.projectPath, params.query, {
      outputStyle: entryPoint.outputStyle,
      model: options.model,
      mcpConfig: options.mcpConfig,
      timeout: options.timeout,
      filterThinking: options.filterThinking
    });
    return {
      success: true,
      rawResult: queryResult.result,
      metadata: {
        entryPoint: params.entryPoint,
        duration: queryResult.metadata.durationMs,
        model: options.model || "sonnet"
      }
    };
  }
  /**
   * 진입점 목록 조회
   */
  listEntryPoints() {
    return this.entryPointManager.listEntryPoints();
  }
  /**
   * 진입점 상세 조회
   */
  getEntryPointInfo(name) {
    return this.entryPointManager.getEntryPoint(name);
  }
  /**
   * 쿼리 API 인스턴스 반환 (Kill 등을 위해)
   */
  getQueryAPI() {
    return this.queryAPI;
  }
};

// src/errors/errors.ts
var AppError = class extends Error {
  constructor(message, code, context) {
    super(message);
    this.code = code;
    this.context = context;
    this.name = "AppError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack
    };
  }
};
var ExecutionError = class extends AppError {
  constructor(message, code, context) {
    super(message, code, context);
    this.name = "ExecutionError";
  }
};
var ProcessStartError = class extends ExecutionError {
  constructor(message, context) {
    super(message, "PROCESS_START_FAILED", context);
    this.name = "ProcessStartError";
  }
};
var ProcessKillError = class extends ExecutionError {
  constructor(message, context) {
    super(message, "PROCESS_KILL_FAILED", context);
    this.name = "ProcessKillError";
  }
};
var MaxConcurrentError = class extends ExecutionError {
  constructor(maxConcurrent, context) {
    super(`Maximum concurrent executions (${maxConcurrent}) reached`, "MAX_CONCURRENT_REACHED", {
      maxConcurrent,
      ...context
    });
    this.name = "MaxConcurrentError";
  }
};
var ExecutionNotFoundError = class extends ExecutionError {
  constructor(sessionId, context) {
    super(`Execution not found: ${sessionId}`, "EXECUTION_NOT_FOUND", {
      sessionId,
      ...context
    });
    this.name = "ExecutionNotFoundError";
  }
};
var ValidationError = class extends AppError {
  constructor(message, code, context) {
    super(message, code, context);
    this.name = "ValidationError";
  }
};

// src/process/ProcessManager.ts
var ProcessManager = class {
  constructor(options = {}) {
    this.executions = /* @__PURE__ */ new Map();
    this.maxConcurrent = options.maxConcurrent ?? 10;
    this.maxHistorySize = options.maxHistorySize ?? 100;
    this.autoCleanupInterval = options.autoCleanupInterval ?? 0;
    if (this.autoCleanupInterval > 0) {
      this.startAutoCleanup();
    }
  }
  /**
   * Start automatic cleanup timer
   */
  startAutoCleanup() {
    if (this.autoCleanupTimer) {
      clearInterval(this.autoCleanupTimer);
    }
    this.autoCleanupTimer = setInterval(() => {
      this.enforceHistoryLimit();
    }, this.autoCleanupInterval);
  }
  /**
   * Stop automatic cleanup timer
   */
  stopAutoCleanup() {
    if (this.autoCleanupTimer) {
      clearInterval(this.autoCleanupTimer);
      this.autoCleanupTimer = void 0;
    }
  }
  /**
   * Enforce history size limit by removing oldest completed executions
   */
  enforceHistoryLimit() {
    const completed = this.getCompletedExecutions();
    if (completed.length <= this.maxHistorySize) {
      return;
    }
    const sorted = completed.sort((a, b) => {
      const aTime = a.endTime ?? a.startTime;
      const bTime = b.endTime ?? b.startTime;
      return aTime - bTime;
    });
    const toRemove = sorted.slice(0, completed.length - this.maxHistorySize);
    let removed = 0;
    for (const execution of toRemove) {
      try {
        this.executions.delete(execution.sessionId);
        removed++;
      } catch (error) {
        console.error("Error removing execution", error instanceof Error ? error : void 0, {
          module: "ProcessManager",
          sessionId: execution.sessionId
        });
      }
    }
    if (removed > 0) {
      console.log("Enforced history limit", {
        module: "ProcessManager",
        removed,
        remaining: this.executions.size,
        limit: this.maxHistorySize
      });
      this.notifyExecutionsChanged();
    }
  }
  /**
   * Destroy the process manager and cleanup resources
   */
  destroy() {
    this.stopAutoCleanup();
    this.killAll();
    this.executions.clear();
  }
  /**
   * Set listener for executions state changes
   */
  setExecutionsChangeListener(listener) {
    this.executionsChangeListener = listener;
  }
  /**
   * Notify listeners of executions state change
   */
  notifyExecutionsChanged() {
    if (this.executionsChangeListener) {
      this.executionsChangeListener();
    }
  }
  /**
   * Start a new execution
   * Returns a Promise that resolves with sessionId once it's received from Claude CLI
   */
  async startExecution(params) {
    const activeCount = this.getActiveExecutions().length;
    if (activeCount >= this.maxConcurrent) {
      throw new MaxConcurrentError(this.maxConcurrent, {
        activeCount,
        projectPath: params.projectPath
      });
    }
    console.log("Starting execution", {
      module: "ProcessManager",
      projectPath: params.projectPath,
      query: `${params.query.substring(0, 50)}...`,
      resumeSession: params.sessionId || "new",
      skillId: params.skillId,
      skillScope: params.skillScope
    });
    let enhancedQuery = params.query;
    if (params.skillId && params.skillScope) {
      const skillReference = params.skillScope === "global" ? `@${params.skillId}` : `@${params.skillId}:project`;
      enhancedQuery = `${skillReference}

${params.query}`;
      console.log("Enhanced query with skill", {
        module: "ProcessManager",
        skillId: params.skillId
      });
    }
    if (params.sessionId) {
      if (this.executions.has(params.sessionId)) {
        throw new ProcessStartError(`Execution with sessionId ${params.sessionId} already exists`, {
          sessionId: params.sessionId,
          projectPath: params.projectPath
        });
      }
    }
    let resolveSessionId;
    let rejectSessionId;
    const sessionIdPromise = new Promise((resolve, reject) => {
      resolveSessionId = resolve;
      rejectSessionId = reject;
    });
    let tempExecution = null;
    const getCurrentExecution = () => {
      if (params.sessionId) {
        return this.executions.get(params.sessionId) ?? null;
      }
      if (tempExecution) {
        return tempExecution;
      }
      const found = Array.from(this.executions.values()).find(
        (exec) => exec === tempExecution
      );
      return found ?? null;
    };
    const getCurrentSessionId = () => {
      if (params.sessionId) return params.sessionId;
      if (tempExecution?.sessionId) return tempExecution.sessionId;
      return null;
    };
    const clientOptions = {
      cwd: params.projectPath,
      model: params.model,
      sessionId: params.sessionId,
      mcpConfig: params.mcpConfig,
      onStream: (event) => {
        if (isSystemInitEvent(event) && !params.sessionId) {
          const newSessionId = event.session_id;
          console.debug("Received sessionId from system:init", {
            module: "ProcessManager",
            sessionId: newSessionId
          });
          resolveSessionId?.(newSessionId);
          if (tempExecution) {
            tempExecution.sessionId = newSessionId;
            this.executions.set(newSessionId, tempExecution);
            this.notifyExecutionsChanged();
          }
        }
        const execution = getCurrentExecution();
        const currentSessionId = getCurrentSessionId();
        if (execution) {
          execution.events.push(event);
        }
        if (params.onStream && currentSessionId) {
          params.onStream(currentSessionId, event);
        }
      },
      onError: (error) => {
        const execution = getCurrentExecution();
        const currentSessionId = getCurrentSessionId();
        if (execution) {
          execution.errors.push(error);
        }
        if (params.onError && currentSessionId) {
          params.onError(currentSessionId, error);
        }
      },
      onClose: (code) => {
        const execution = getCurrentExecution();
        const currentSessionId = getCurrentSessionId();
        if (execution) {
          execution.status = code === 0 ? "completed" : "failed";
          execution.endTime = Date.now();
          if (currentSessionId) {
            console.log("Execution completed", {
              module: "ProcessManager",
              sessionId: currentSessionId,
              status: execution.status,
              duration: execution.endTime - execution.startTime
            });
          }
          this.notifyExecutionsChanged();
        }
        if (params.onComplete && currentSessionId) {
          params.onComplete(currentSessionId, code);
        }
      }
    };
    const client = new ClaudeClient(clientOptions);
    const executionInfo = {
      sessionId: params.sessionId || "",
      // Will be updated from system:init if empty
      projectPath: params.projectPath,
      query: params.query,
      status: "pending",
      pid: null,
      client,
      events: [],
      errors: [],
      startTime: Date.now(),
      endTime: null,
      mcpConfig: params.mcpConfig,
      model: params.model,
      skillId: params.skillId,
      skillScope: params.skillScope,
      outputStyle: params.outputStyle,
      agentName: params.agentName,
      taskId: params.taskId
    };
    if (params.sessionId) {
      this.executions.set(params.sessionId, executionInfo);
      resolveSessionId?.(params.sessionId);
      this.notifyExecutionsChanged();
    } else {
      tempExecution = executionInfo;
    }
    try {
      const process2 = client.execute(enhancedQuery);
      executionInfo.pid = process2.pid || null;
      executionInfo.status = "running";
      console.log("Execution started", {
        module: "ProcessManager",
        sessionId: params.sessionId || "pending",
        pid: executionInfo.pid
      });
      if (params.sessionId) {
        this.notifyExecutionsChanged();
      }
    } catch (error) {
      executionInfo.status = "failed";
      executionInfo.endTime = Date.now();
      const errorMsg = error instanceof Error ? error.message : String(error);
      executionInfo.errors.push(errorMsg);
      console.error("Execution failed to start", error instanceof Error ? error : void 0, {
        module: "ProcessManager",
        sessionId: params.sessionId || "unknown",
        error: errorMsg
      });
      if (!params.sessionId) {
        const startError = error instanceof Error ? new ProcessStartError(error.message, {
          projectPath: params.projectPath,
          query: params.query
        }) : new ProcessStartError(errorMsg, {
          projectPath: params.projectPath,
          query: params.query
        });
        rejectSessionId?.(startError);
      }
      throw error instanceof Error ? error : new ProcessStartError(errorMsg);
    }
    const timeoutPromise = new Promise(
      (_, reject) => setTimeout(
        () => reject(new Error("Timeout waiting for sessionId from Claude CLI")),
        1e4
        // 10 second timeout
      )
    );
    try {
      const finalSessionId = await Promise.race([sessionIdPromise, timeoutPromise]);
      return finalSessionId;
    } catch (error) {
      if (tempExecution) {
        tempExecution.status = "failed";
        tempExecution.endTime = Date.now();
        tempExecution.errors.push(
          error instanceof Error ? error.message : "SessionId resolution failed"
        );
      }
      throw error;
    }
  }
  /**
   * Get execution info by sessionId
   */
  getExecution(sessionId) {
    return this.executions.get(sessionId);
  }
  /**
   * Get all executions
   */
  getAllExecutions() {
    return Array.from(this.executions.values());
  }
  /**
   * Get active (running or pending) executions
   */
  getActiveExecutions() {
    return this.getAllExecutions().filter(
      (exec) => exec.status === "running" || exec.status === "pending"
    );
  }
  /**
   * Get completed executions
   */
  getCompletedExecutions() {
    return this.getAllExecutions().filter(
      (exec) => exec.status === "completed" || exec.status === "failed" || exec.status === "killed"
    );
  }
  /**
   * Kill an execution
   */
  killExecution(sessionId) {
    const execution = this.executions.get(sessionId);
    if (!execution) {
      throw new ExecutionNotFoundError(sessionId);
    }
    if (execution.status !== "running" && execution.status !== "pending") {
      console.warn("Execution already terminated", {
        module: "ProcessManager",
        sessionId,
        status: execution.status
      });
      return;
    }
    console.log("Killing execution", {
      module: "ProcessManager",
      sessionId
    });
    try {
      execution.client.kill();
      execution.status = "killed";
      execution.endTime = Date.now();
      this.notifyExecutionsChanged();
    } catch (error) {
      const killError = new ProcessKillError(
        `Failed to kill execution: ${error instanceof Error ? error.message : String(error)}`,
        {
          sessionId,
          originalError: error
        }
      );
      console.error("Failed to kill execution", error instanceof Error ? error : void 0, {
        module: "ProcessManager",
        sessionId
      });
      execution.status = "failed";
      execution.endTime = Date.now();
      this.notifyExecutionsChanged();
      throw killError;
    }
  }
  /**
   * Clean up an execution (remove from memory)
   */
  cleanupExecution(sessionId) {
    const execution = this.executions.get(sessionId);
    if (!execution) {
      console.warn("Execution not found for cleanup", {
        module: "ProcessManager",
        sessionId
      });
      return;
    }
    if (execution.status === "running" || execution.status === "pending") {
      throw new ProcessKillError("Cannot cleanup active execution. Kill it first.", {
        sessionId,
        status: execution.status
      });
    }
    console.log("Cleaning up execution", {
      module: "ProcessManager",
      sessionId
    });
    this.executions.delete(sessionId);
    this.notifyExecutionsChanged();
  }
  /**
   * Clean up all completed executions
   */
  cleanupAllCompleted() {
    const completedIds = this.getCompletedExecutions().map((e) => e.sessionId);
    for (const id of completedIds) {
      this.cleanupExecution(id);
    }
    console.log("Cleaned up executions", {
      module: "ProcessManager",
      count: completedIds.length
    });
    return completedIds.length;
  }
  /**
   * Kill all active executions
   */
  killAll() {
    const activeExecutions = this.getActiveExecutions();
    console.log("Killing all executions", {
      module: "ProcessManager",
      count: activeExecutions.length
    });
    for (const execution of activeExecutions) {
      this.killExecution(execution.sessionId);
    }
  }
  /**
   * Get execution statistics
   */
  getStats() {
    const executions = this.getAllExecutions();
    return {
      total: executions.length,
      running: executions.filter((e) => e.status === "running").length,
      pending: executions.filter((e) => e.status === "pending").length,
      completed: executions.filter((e) => e.status === "completed").length,
      failed: executions.filter((e) => e.status === "failed").length,
      killed: executions.filter((e) => e.status === "killed").length
    };
  }
  /**
   * Set maximum concurrent executions
   */
  setMaxConcurrent(max) {
    if (max < 1) {
      throw new ValidationError(
        "Maximum concurrent executions must be at least 1",
        "INVALID_MAX_CONCURRENT",
        {
          providedValue: max,
          minimumValue: 1
        }
      );
    }
    this.maxConcurrent = max;
    console.log("Max concurrent set", {
      module: "ProcessManager",
      maxConcurrent: max
    });
  }
  /**
   * Get maximum concurrent executions
   */
  getMaxConcurrent() {
    return this.maxConcurrent;
  }
};
var processManager = new ProcessManager();

// src/index.ts
init_zodSchemaBuilder();

// src/session/SessionManager.ts
var SessionManager = class {
  constructor() {
    this.sessions = /* @__PURE__ */ new Map();
    this.currentSessionId = null;
  }
  /**
   * Create or update a session
   */
  saveSession(sessionId, info) {
    const session = {
      sessionId,
      ...info
    };
    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    console.log("[SessionManager] Saved session:", sessionId);
  }
  /**
   * Get session by ID
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }
  /**
   * Get all sessions sorted by timestamp (most recent first)
   */
  getAllSessions() {
    return Array.from(this.sessions.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
  /**
   * Get current session ID
   */
  getCurrentSessionId() {
    return this.currentSessionId;
  }
  /**
   * Set current session ID
   */
  setCurrentSessionId(sessionId) {
    this.currentSessionId = sessionId;
  }
  /**
   * Update session with result
   */
  updateSessionResult(sessionId, result) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastResult = result;
      this.sessions.set(sessionId, session);
    }
  }
  /**
   * Clear all sessions
   */
  clearSessions() {
    this.sessions.clear();
    this.currentSessionId = null;
    console.log("[SessionManager] Cleared all sessions");
  }
  /**
   * Remove a specific session
   */
  removeSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    if (deleted && this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
    return deleted;
  }
  /**
   * Get session count
   */
  getSessionCount() {
    return this.sessions.size;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ClaudeClient,
  ClaudeQueryAPI,
  CommonSchemas,
  EntryPointExecutor,
  EntryPointManager,
  ExecutionNotFoundError,
  MaxConcurrentError,
  ProcessKillError,
  ProcessManager,
  ProcessStartError,
  SchemaManager,
  SessionManager,
  StreamParser,
  ValidationError,
  buildSchemaPrompt,
  extractAndValidate,
  extractJSON,
  extractSessionId,
  extractTextFromMessage,
  extractToolUsesFromMessage,
  isAssistantEvent,
  isErrorEvent,
  isResultEvent,
  isSystemInitEvent,
  isUserEvent,
  processManager,
  validateAgainstSchema,
  validateWithStandardSchema,
  validateWithZod,
  zodSchemaToPrompt
});
