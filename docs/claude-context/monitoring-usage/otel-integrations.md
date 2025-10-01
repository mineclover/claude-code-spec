# OpenTelemetry Platform Integrations

## Overview
Integration configurations for popular observability platforms.

## Datadog

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://api.datadoghq.com",
    "OTEL_EXPORTER_OTLP_HEADERS": "DD-API-KEY=${DATADOG_API_KEY}",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

**Setup:**
1. Get API key from Datadog dashboard
2. Set `DATADOG_API_KEY` environment variable
3. Configure endpoint to Datadog's API

## New Relic

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otlp.nr-data.net:4318",
    "OTEL_EXPORTER_OTLP_HEADERS": "api-key=${NEW_RELIC_LICENSE_KEY}",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

**Setup:**
1. Get license key from New Relic account
2. Set `NEW_RELIC_LICENSE_KEY` environment variable
3. Use New Relic's OTLP endpoint

## Honeycomb

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://api.honeycomb.io",
    "OTEL_EXPORTER_OTLP_HEADERS": "x-honeycomb-team=${HONEYCOMB_API_KEY}",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

**Setup:**
1. Get API key from Honeycomb project settings
2. Set `HONEYCOMB_API_KEY` environment variable
3. Optionally add dataset: `x-honeycomb-dataset=claude-code`

## Grafana Cloud

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otlp-gateway-prod.grafana.net/otlp",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Basic ${GRAFANA_CLOUD_TOKEN}",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

**Setup:**
1. Generate Cloud Access Policy token
2. Base64 encode: `instance_id:token`
3. Set as `GRAFANA_CLOUD_TOKEN`

## Generic OTLP Collector

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_TRACES_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

**Use Cases:**
- Local development with OpenTelemetry Collector
- Custom telemetry pipeline
- Self-hosted observability stack

## Security Best Practices

### Credential Management
- Store API keys in environment variables, never hardcode
- Use `.claude/settings.local.json` for local settings (not committed to git)
- Add `.claude/settings.local.json` to `.gitignore`
- Rotate tokens regularly

### Example with Environment Variables
```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "${OTEL_ENDPOINT}",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer ${OTEL_API_KEY}",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

Then set in shell:
```bash
export OTEL_ENDPOINT="https://collector.company.com"
export OTEL_API_KEY="secret-token"
```