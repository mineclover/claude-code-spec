# OpenTelemetry Configuration

## Overview

Claude Code supports OpenTelemetry (OTEL) for observability and telemetry data collection. Configure telemetry behavior through environment variables in settings.

## Telemetry Control

### Enable Telemetry
Enable OpenTelemetry data collection.

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1"
  }
}
```

**Default**: Telemetry enabled

### Disable All Telemetry
Completely opt out of telemetry collection.

```json
{
  "env": {
    "DISABLE_TELEMETRY": "1"
  }
}
```

**Effect**: Disables Statsig analytics and usage tracking

### Disable Non-Essential Traffic
Disable multiple telemetry features at once.

```json
{
  "env": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

**Effect**:
- Disables analytics
- Disables crash reporting
- Disables update checks
- Reduces network traffic

## OTEL Exporters

### Metrics Exporter
Configure OpenTelemetry metrics exporter.

```json
{
  "env": {
    "OTEL_METRICS_EXPORTER": "otlp"
  }
}
```

**Options:**
- `"otlp"`: OpenTelemetry Protocol (recommended)
- `"prometheus"`: Prometheus metrics format
- `"none"`: Disable metrics export

### Traces Exporter
Configure OpenTelemetry traces exporter.

```json
{
  "env": {
    "OTEL_TRACES_EXPORTER": "otlp"
  }
}
```

**Options:**
- `"otlp"`: OpenTelemetry Protocol
- `"jaeger"`: Jaeger tracing format
- `"zipkin"`: Zipkin tracing format
- `"none"`: Disable traces export

### Logs Exporter
Configure OpenTelemetry logs exporter.

```json
{
  "env": {
    "OTEL_LOGS_EXPORTER": "otlp"
  }
}
```

## OTEL Endpoint Configuration

### OTLP Endpoint
Set the OpenTelemetry Protocol endpoint.

```json
{
  "env": {
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318"
  }
}
```

**Default**: No endpoint configured

### Metrics Endpoint
Separate endpoint for metrics data.

```json
{
  "env": {
    "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT": "http://metrics-collector:4318/v1/metrics"
  }
}
```

### Traces Endpoint
Separate endpoint for traces data.

```json
{
  "env": {
    "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": "http://traces-collector:4318/v1/traces"
  }
}
```

## OTLP Protocol

### Protocol Selection
Choose transport protocol for OTLP.

```json
{
  "env": {
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc"
  }
}
```

**Options:**
- `"grpc"`: gRPC protocol (binary, efficient)
- `"http/protobuf"`: HTTP with protobuf encoding
- `"http/json"`: HTTP with JSON encoding

## Authentication

### Headers for Authentication
Add authentication headers to OTLP requests.

```json
{
  "env": {
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer token123,X-API-Key=key456"
  }
}
```

**Format**: Comma-separated key=value pairs

## Resource Attributes

### Service Name
Identify your Claude Code instance.

```json
{
  "env": {
    "OTEL_SERVICE_NAME": "claude-code-dev-team"
  }
}
```

### Additional Attributes
Add custom resource attributes.

```json
{
  "env": {
    "OTEL_RESOURCE_ATTRIBUTES": "environment=production,team=platform,region=us-east-1"
  }
}
```

**Format**: Comma-separated key=value pairs

## Sampling Configuration

### Trace Sampling
Control trace sampling rate.

```json
{
  "env": {
    "OTEL_TRACES_SAMPLER": "traceidratio",
    "OTEL_TRACES_SAMPLER_ARG": "0.1"
  }
}
```

**Samplers:**
- `"always_on"`: Sample all traces
- `"always_off"`: Sample no traces
- `"traceidratio"`: Sample percentage (set with `OTEL_TRACES_SAMPLER_ARG`)
- `"parentbased_*"`: Respect parent span sampling decision

## Complete OTEL Example

### Development Environment
```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_TRACES_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
    "OTEL_SERVICE_NAME": "claude-code-dev",
    "OTEL_RESOURCE_ATTRIBUTES": "environment=development,developer=john"
  }
}
```

### Production Environment
```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_TRACES_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otel-collector.company.com:4318",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "grpc",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer ${OTEL_TOKEN}",
    "OTEL_SERVICE_NAME": "claude-code-prod",
    "OTEL_RESOURCE_ATTRIBUTES": "environment=production,team=engineering,region=us-east-1",
    "OTEL_TRACES_SAMPLER": "traceidratio",
    "OTEL_TRACES_SAMPLER_ARG": "0.1"
  }
}
```

### Privacy-Focused (Telemetry Disabled)
```json
{
  "env": {
    "DISABLE_TELEMETRY": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

## Integration with Observability Platforms

### Datadog
```json
{
  "env": {
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://api.datadoghq.com",
    "OTEL_EXPORTER_OTLP_HEADERS": "DD-API-KEY=${DATADOG_API_KEY}",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

### New Relic
```json
{
  "env": {
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otlp.nr-data.net:4318",
    "OTEL_EXPORTER_OTLP_HEADERS": "api-key=${NEW_RELIC_LICENSE_KEY}",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

### Honeycomb
```json
{
  "env": {
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://api.honeycomb.io",
    "OTEL_EXPORTER_OTLP_HEADERS": "x-honeycomb-team=${HONEYCOMB_API_KEY}",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

### Grafana Cloud
```json
{
  "env": {
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otlp-gateway-prod.grafana.net/otlp",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Basic ${GRAFANA_CLOUD_TOKEN}",
    "OTEL_SERVICE_NAME": "claude-code"
  }
}
```

## Troubleshooting

### Verify Telemetry Status
Check if telemetry is active:

```bash
# Enable debug logging
export OTEL_LOG_LEVEL=debug
claude -p "test prompt"
```

### Common Issues

**No data reaching collector:**
- Verify endpoint URL is correct
- Check network connectivity
- Validate authentication headers
- Review firewall rules

**High overhead:**
- Reduce sampling rate: `OTEL_TRACES_SAMPLER_ARG=0.01`
- Disable unused exporters
- Use efficient protocol: `grpc` instead of `http/json`

**Authentication failures:**
- Ensure API keys are not expired
- Verify header format is correct
- Check token has proper permissions

## Best Practices

### Security
- Use environment variables for credentials, never hardcode
- Store tokens in `.claude/settings.local.json`, not shared settings
- Rotate tokens regularly
- Use least-privilege access for telemetry endpoints

### Performance
- Start with low sampling rates (5-10%) in production
- Use gRPC protocol for better performance
- Configure separate endpoints for metrics/traces if needed
- Monitor collector resource usage

### Privacy
- Review what data is collected before enabling
- Use `DISABLE_TELEMETRY=1` for sensitive environments
- Configure sampling to reduce data volume
- Ensure compliance with data retention policies