# Maintenance Service Registry

`CliMaintenanceService` can load additional service adapters from app settings.

- Settings key: `maintenanceServices` in app settings (`app-settings.json`)
- Configure from app UI (Settings page) instead of editing source code
- JSON example payload: `references/maintenance-services.example.json`
- CLI execution reference review: `references/ralph-tui-execution-review.md`

## JSON shape

```json
[
  {
    "id": "service-id",
    "name": "Display Name",
    "enabled": true,
    "capability": {
      "maintenance": { "enabled": true },
      "execution": { "enabled": false },
      "skills": { "enabled": true },
      "mcp": { "enabled": false }
    },
    "tools": [
      {
        "id": "tool-id",
        "name": "Tool Name",
        "description": "Optional",
        "versionCommand": { "command": "tool", "args": ["--version"] },
        "updateCommand": { "command": "npm", "args": ["install", "-g", "tool@latest"] },
        "docsUrl": "https://example.com/docs"
      }
    ],
    "skillStore": {
      "provider": "service-provider",
      "installRoot": "~/.service/skills",
      "disabledRoot": "~/.service/skills-disabled",
      "reference": "optional/source/path"
    }
  }
]
```

Notes:

- `tools` and `skillStore` are optional, but at least one must be present.
- `capability` is optional. Missing fields use safe defaults.
- `disabledRoot` is optional. If omitted, it is inferred from `installRoot`.
- `${ENV_VAR}` placeholders and `~` are expanded in command/paths.
- If custom `tool.id` or `skillStore.provider` matches built-in, custom config overrides built-in.

## Capability Matrix Standard Schema

```json
{
  "capability": {
    "maintenance": { "enabled": true },
    "execution": { "enabled": false },
    "skills": { "enabled": true },
    "mcp": { "enabled": false }
  }
}
```

- `maintenance`: CLI version check/update capability
- `execution`: session/process execution capability
- `skills`: skill store/skill lifecycle capability
- `mcp`: MCP config/launch capability

Safe default behavior when `capability` is omitted:

- `maintenance.enabled`: `tools`가 있으면 `true`, 없으면 `false`
- `skills.enabled`: `skillStore`가 있으면 `true`, 없으면 `false`
- `execution.enabled`: `false`
- `mcp.enabled`: `false`

## Built-in Service Capability Examples

```json
[
  {
    "id": "claude",
    "capability": {
      "maintenance": { "enabled": true },
      "execution": { "enabled": true },
      "skills": { "enabled": true },
      "mcp": { "enabled": true }
    }
  },
  {
    "id": "codex",
    "capability": {
      "maintenance": { "enabled": true },
      "execution": { "enabled": true },
      "skills": { "enabled": true },
      "mcp": { "enabled": true }
    }
  },
  {
    "id": "gemini",
    "capability": {
      "maintenance": { "enabled": true },
      "execution": { "enabled": true },
      "skills": { "enabled": true },
      "mcp": { "enabled": true }
    }
  },
  {
    "id": "ralph",
    "capability": {
      "maintenance": { "enabled": true },
      "execution": { "enabled": true },
      "skills": { "enabled": false },
      "mcp": { "enabled": false }
    }
  },
  {
    "id": "moai",
    "capability": {
      "maintenance": { "enabled": true },
      "execution": { "enabled": true },
      "skills": { "enabled": false },
      "mcp": { "enabled": false }
    }
  }
]
```

## Standardized Onboarding Checklist

When adding a new service to `maintenanceServices`, follow this order:

1. Identify the canonical executable name (`tool.id` and `versionCommand.command`)
2. Pick one of the update command patterns below
3. Verify commands manually in shell
4. Add JSON entry (prefer minimal fields first)
5. Save in UI and run **Check Versions** + **Update** once

## Standard Command Patterns

### Pattern A: npm global package

```json
{
  "id": "tool-id",
  "name": "Tool Name",
  "tools": [
    {
      "id": "tool-id",
      "name": "Tool Name",
      "versionCommand": { "command": "tool", "args": ["--version"] },
      "updateCommand": { "command": "npm", "args": ["install", "-g", "package@latest"] }
    }
  ]
}
```

### Pattern B: self-updating binary (recommended for moai-adk)

```json
{
  "id": "moai",
  "name": "MoAI-ADK",
  "tools": [
    {
      "id": "moai",
      "name": "MoAI-ADK",
      "versionCommand": { "command": "moai", "args": ["version"] },
      "updateCommand": { "command": "moai", "args": ["update", "--binary", "--yes"] }
    }
  ]
}
```

### Pattern C: skill-store-only provider

```json
{
  "id": "provider-id",
  "name": "Provider Name",
  "skillStore": {
    "provider": "provider-id",
    "installRoot": "~/.provider/skills",
    "disabledRoot": "~/.provider/skills-disabled"
  }
}
```

## Naming Conventions

- service id: lowercase kebab-case (e.g. `moai`, `acme`)
- tool id: stable executable identity (same as CLI name when possible)
- provider: same as service id unless there is a clear namespace reason
- prefer non-interactive update args (`--yes`, `--binary`, etc.) when supported

## Runtime Validation Rules

Registry save is rejected unless all rules pass:

- root value must be an array
- each service must have non-empty `id`
- each service must include at least one of:
  - `tools` with at least one valid tool, or
  - `skillStore`
- each tool must include non-empty `id`, `name`, `versionCommand.command`, `updateCommand.command`
- command `args` must be an array of non-empty strings (if present)
- `docsUrl` must be a valid URL (if present)
