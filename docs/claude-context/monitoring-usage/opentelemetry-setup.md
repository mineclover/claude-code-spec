# OpenTelemetry Setup

## Configuration Methods

### Settings Hierarchy
Settings are evaluated in precedence order (highest to lowest):

1. **Enterprise Managed Policies** - Organization-wide enforcement (cannot be overridden)
2. **Command Line Arguments** - Temporary session overrides
3. **Local Project Settings** - `.claude/settings.local.json` (not in git)
4. **Shared Project Settings** - `.claude/settings.json` (in git)
5. **User Settings** - `~/.claude/settings.json` (global)

**Merging Behavior:**
- Simple values: Higher level overrides lower level
- Objects: Merged recursively, higher level keys take precedence
- Arrays: Higher level replaces lower level entirely

### Method 1: Local Project Settings (Recommended for Development)
Configure via `.claude/settings.local.json` in your project:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
    "OTEL_METRIC_EXPORT_INTERVAL": "60000",
    "OTEL_LOGS_EXPORT_INTERVAL": "5000"
  }
}
```

**Advantages:**
- Not committed to git (personal configuration)
- Overrides shared project settings
- Safe for API keys and secrets

**Add to `.gitignore`:**
```
.claude/settings.local.json
```

### Method 2: Shared Project Settings (Team Configuration)
Configure via `.claude/settings.json` for team-wide defaults:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_SERVICE_NAME": "claude-code-team"
  }
}
```

**Advantages:**
- Shared across team via git
- Consistent team configuration
- Can be overridden by local settings

### Method 3: Command Line Arguments (Temporary Override)
Override settings for current session:

```bash
# Enable telemetry temporarily
claude --env CLAUDE_CODE_ENABLE_TELEMETRY=1 -p "your prompt"
```

### Method 4: Environment Variables (Global)
Set in shell configuration (`.bashrc`, `.zshrc`, etc.):

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

**Note:** Settings files take precedence over environment variables.

### Verification
Check if telemetry is enabled:
```bash
echo $CLAUDE_CODE_ENABLE_TELEMETRY
```

## Core Configuration Variables

### Telemetry Control
- `CLAUDE_CODE_ENABLE_TELEMETRY=1` - Enable OpenTelemetry collection
- `DISABLE_TELEMETRY=1` - Completely disable all telemetry
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` - Disable analytics, crash reporting, update checks

### Exporter Configuration
- `OTEL_METRICS_EXPORTER` - Metrics exporter type: `otlp`, `prometheus`, `none`
- `OTEL_TRACES_EXPORTER` - Traces exporter type: `otlp`, `jaeger`, `zipkin`, `none`
- `OTEL_LOGS_EXPORTER` - Logs exporter type: `otlp`, `none`

### Endpoint Configuration
- `OTEL_EXPORTER_OTLP_ENDPOINT` - Base OTLP endpoint (e.g., `http://localhost:4318`)
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` - Specific metrics endpoint
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` - Specific traces endpoint

### Protocol Configuration
- `OTEL_EXPORTER_OTLP_PROTOCOL` - Transport protocol: `grpc`, `http/protobuf`, `http/json`

### Export Intervals
- `OTEL_METRIC_EXPORT_INTERVAL` - Metrics export interval in milliseconds (default: 60000)
- `OTEL_LOGS_EXPORT_INTERVAL` - Logs export interval in milliseconds (default: 5000)

### Service Identification
- `OTEL_SERVICE_NAME` - Service name for identification (e.g., `claude-code-dev`)
- `OTEL_RESOURCE_ATTRIBUTES` - Custom attributes: `environment=production,team=eng`

### Authentication
- `OTEL_EXPORTER_OTLP_HEADERS` - Auth headers: `Authorization=Bearer token,X-API-Key=key`

## Collection Triggers

OpenTelemetry data is collected when:

### 1. Session Events
- **Session Start**: Counter incremented at the start of each Claude Code session

### 2. Code Modifications
- **Lines of Code**: Counter triggered when code is added or removed

### 3. Git Operations
- **Pull Request Creation**: Metrics collected when creating PRs
- **Commit Creation**: Metrics collected when creating git commits

### 4. API Interactions
- **API Requests**: Each request to Claude API
- **API Errors**: Error events logged
- **Token Usage**: Token consumption tracking

### 5. Tool Usage
- **Tool Execution**: Events captured when tools complete execution
- **Permission Decisions**: User accept/reject decisions for tool permissions

## Metrics Collected

- Session counters
- Lines of code changed
- Git operation counts
- API request/error rates
- Token usage statistics
- Tool execution counts
- User permission decision patterns

## Configuration Examples

### Local Development
```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
    "OTEL_SERVICE_NAME": "claude-code-dev"
  }
}
```

### Production with Sampling
```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_TRACES_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otel-collector.company.com:4318",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_TRACES_SAMPLER": "traceidratio",
    "OTEL_TRACES_SAMPLER_ARG": "0.1",
    "OTEL_SERVICE_NAME": "claude-code-prod",
    "OTEL_RESOURCE_ATTRIBUTES": "environment=production,team=eng"
  }
}
```

### Privacy Mode (Disabled)
```json
{
  "env": {
    "DISABLE_TELEMETRY": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

## Troubleshooting

### Verify Configuration
```bash
# Check environment variables
env | grep -E "(CLAUDE_CODE|OTEL_)"

# Enable debug logging
export OTEL_LOG_LEVEL=debug
```

### Common Issues
- **No data reaching collector**: Verify endpoint URL and network connectivity
- **Authentication failures**: Check API keys and header format
- **High overhead**: Reduce sampling rate or export intervals