/**
 * Application-level settings storage service
 * Stores user preferences like Claude Projects path in JSON file
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

interface AppSettings {
  claudeProjectsPath?: string;
  currentProjectPath?: string;
  currentProjectDirName?: string;
  mcpResourcePaths?: string[]; // Additional MCP config file paths
}

export class SettingsService {
  private settingsPath: string;
  private settings: AppSettings = {};

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'app-settings.json');
    this.loadSettings();
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        this.settings = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = {};
    }
  }

  private saveSettings(): void {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getClaudeProjectsPath(): string | undefined {
    return this.settings.claudeProjectsPath;
  }

  setClaudeProjectsPath(projectsPath: string): void {
    this.settings.claudeProjectsPath = projectsPath;
    this.saveSettings();
  }

  getAllSettings(): AppSettings {
    return { ...this.settings };
  }

  getCurrentProjectPath(): string | undefined {
    console.log('[SettingsService] getCurrentProjectPath:', this.settings.currentProjectPath);
    return this.settings.currentProjectPath;
  }

  getCurrentProjectDirName(): string | undefined {
    console.log('[SettingsService] getCurrentProjectDirName:', this.settings.currentProjectDirName);
    return this.settings.currentProjectDirName;
  }

  setCurrentProject(projectPath: string, projectDirName: string): void {
    console.log('[SettingsService] setCurrentProject:', { projectPath, projectDirName });
    this.settings.currentProjectPath = projectPath;
    this.settings.currentProjectDirName = projectDirName;
    this.saveSettings();
    console.log('[SettingsService] Settings after save:', this.settings);
  }

  clearCurrentProject(): void {
    console.log('[SettingsService] clearCurrentProject');
    this.settings.currentProjectPath = undefined;
    this.settings.currentProjectDirName = undefined;
    this.saveSettings();
  }

  // MCP Resource Paths methods
  getMcpResourcePaths(): string[] {
    return this.settings.mcpResourcePaths || [];
  }

  setMcpResourcePaths(paths: string[]): void {
    this.settings.mcpResourcePaths = paths;
    this.saveSettings();
  }

  addMcpResourcePath(path: string): void {
    if (!this.settings.mcpResourcePaths) {
      this.settings.mcpResourcePaths = [];
    }

    // Avoid duplicates
    if (!this.settings.mcpResourcePaths.includes(path)) {
      this.settings.mcpResourcePaths.push(path);
      this.saveSettings();
    }
  }

  removeMcpResourcePath(path: string): void {
    if (this.settings.mcpResourcePaths) {
      this.settings.mcpResourcePaths = this.settings.mcpResourcePaths.filter((p) => p !== path);
      this.saveSettings();
    }
  }

  // Get OS-specific default paths
  getDefaultPaths(): { claudeProjectsPath: string; mcpConfigPath: string } {
    const homeDir = app.getPath('home');
    const platform = process.platform;

    let claudeProjectsPath: string;
    let mcpConfigPath: string;

    if (platform === 'win32') {
      // Windows
      claudeProjectsPath = `${homeDir}\\.claude\\projects`;
      mcpConfigPath = `${homeDir}\\.claude.json`;
    } else {
      // macOS/Linux
      claudeProjectsPath = `${homeDir}/.claude/projects`;
      mcpConfigPath = `${homeDir}/.claude.json`;
    }

    return { claudeProjectsPath, mcpConfigPath };
  }

  // Get default MCP resource path (the standard ~/.claude.json location)
  getDefaultMcpResourcePaths(): string[] {
    const homeDir = app.getPath('home');
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: %USERPROFILE%\.claude.json
      return [`${homeDir}\\.claude.json`];
    } else {
      // macOS/Linux: ~/.claude.json
      return [`${homeDir}/.claude.json`];
    }
  }
}

export const settingsService = new SettingsService();
