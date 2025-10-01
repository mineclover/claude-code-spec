/**
 * Application-level settings storage service
 * Stores user preferences like Claude Projects path in JSON file
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface AppSettings {
  claudeProjectsPath?: string;
  currentProjectPath?: string;
  currentProjectDirName?: string;
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
}

export const settingsService = new SettingsService();
