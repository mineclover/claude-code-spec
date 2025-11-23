/**
 * SessionAnalyzer - Analyzes execution sessions against task success criteria
 *
 * Responsibilities:
 * - Parse task success criteria
 * - Analyze execution results and tool calls
 * - Match criteria patterns in execution outputs
 * - Calculate completion confidence score
 * - Generate review notes with matched criteria
 */

import type { ProcessManager } from '@context-action/code-api';
import { appLogger } from '../main/app-context';
import type { Task } from '../types/task';

export interface CompletionAnalysis {
  completed: boolean;
  matchedCriteria: string[];
  failedCriteria: string[];
  confidence: number; // 0-100
  executionTime: number; // milliseconds
  reviewNotes: string; // Markdown formatted
}

export interface CriterionMatch {
  criterion: string;
  matched: boolean;
  evidence?: string[]; // Evidence from execution (tool calls, outputs, etc.)
  confidence: number; // 0-100
}

export class SessionAnalyzer {
  constructor(private processManager: ProcessManager) {
    appLogger.info('SessionAnalyzer initialized', {
      module: 'SessionAnalyzer',
    });
  }

  /**
   * Analyze if task is completed based on execution session
   */
  async analyzeCompletion(sessionId: string, task: Task): Promise<CompletionAnalysis> {
    appLogger.info('Analyzing completion', {
      module: 'SessionAnalyzer',
      sessionId,
      taskId: task.id,
    });

    try {
      // Get execution info
      const execution = this.processManager.getExecution(sessionId);
      if (!execution) {
        appLogger.warn('Execution not found', {
          module: 'SessionAnalyzer',
          sessionId,
        });
        return this.createFailedAnalysis('Execution not found');
      }

      // Parse success criteria from task
      const criteria = this.parseSuccessCriteria(task.successCriteria || []);

      if (criteria.length === 0) {
        appLogger.warn('No success criteria defined', {
          module: 'SessionAnalyzer',
          taskId: task.id,
        });
        return this.createFailedAnalysis('No success criteria defined');
      }

      // Analyze each criterion
      const criterionMatches = await Promise.all(
        criteria.map((criterion) => this.analyzeCriterion(criterion, execution.events)),
      );

      // Calculate results
      const matchedCriteria = criterionMatches
        .filter((match) => match.matched)
        .map((match) => match.criterion);

      const failedCriteria = criterionMatches
        .filter((match) => !match.matched)
        .map((match) => match.criterion);

      // Calculate overall confidence
      const confidence = this.calculateConfidence(criterionMatches);

      // Determine completion (require >80% confidence and at least 50% criteria matched)
      const completed =
        confidence > 80 && matchedCriteria.length >= Math.ceil(criteria.length * 0.5);

      // Calculate execution time
      const executionTime = execution.endTime
        ? execution.endTime - execution.startTime
        : Date.now() - execution.startTime;

      // Generate review notes
      const reviewNotes = this.generateReviewNotes({
        matchedCriteria,
        failedCriteria,
        confidence,
        executionTime,
        sessionId,
        criterionMatches,
      });

      appLogger.info('Completion analysis complete', {
        module: 'SessionAnalyzer',
        sessionId,
        taskId: task.id,
        completed,
        confidence,
        matchedCount: matchedCriteria.length,
        totalCount: criteria.length,
      });

      return {
        completed,
        matchedCriteria,
        failedCriteria,
        confidence,
        executionTime,
        reviewNotes,
      };
    } catch (error) {
      appLogger.error(
        'Failed to analyze completion',
        error instanceof Error ? error : undefined,
        {
          module: 'SessionAnalyzer',
          sessionId,
          taskId: task.id,
        },
      );
      return this.createFailedAnalysis('Analysis failed: ' + String(error));
    }
  }

  /**
   * Parse success criteria from task
   */
  private parseSuccessCriteria(successCriteria: string[]): string[] {
    return successCriteria
      .map((criterion) => {
        // Remove checkbox markers: [ ], [x], [X]
        return criterion.replace(/^\s*\[[ xX]\]\s*/, '').trim();
      })
      .filter((criterion) => criterion.length > 0);
  }

  /**
   * Analyze a single criterion against execution events
   */
  private async analyzeCriterion(
    criterion: string,
    events: any[],
  ): Promise<CriterionMatch> {
    const evidence: string[] = [];
    let confidence = 0;

    // Extract key terms from criterion
    const keyTerms = this.extractKeyTerms(criterion);

    // Search for evidence in execution events
    for (const event of events) {
      // Check tool use events
      if (event.type === 'tool_use' && event.data?.tool_use) {
        const toolUse = event.data.tool_use;
        const toolName = toolUse.name;
        const toolInput = JSON.stringify(toolUse.input || {});

        // Match key terms in tool name and input
        const matchScore = this.calculateTermMatchScore(keyTerms, `${toolName} ${toolInput}`);
        if (matchScore > 0.3) {
          evidence.push(`Tool: ${toolName}`);
          confidence = Math.max(confidence, matchScore * 100);
        }
      }

      // Check tool result events
      if (event.type === 'tool_result' && event.data?.tool_result) {
        const toolResult = event.data.tool_result;
        const output = JSON.stringify(toolResult.content || '');

        const matchScore = this.calculateTermMatchScore(keyTerms, output);
        if (matchScore > 0.3) {
          evidence.push('Tool result matched');
          confidence = Math.max(confidence, matchScore * 100);
        }
      }

      // Check assistant messages
      if (event.type === 'message' && event.data?.message) {
        const message = event.data.message;
        if (message.role === 'assistant') {
          const content = JSON.stringify(message.content || []);
          const matchScore = this.calculateTermMatchScore(keyTerms, content);
          if (matchScore > 0.3) {
            evidence.push('Assistant message matched');
            confidence = Math.max(confidence, matchScore * 100);
          }
        }
      }
    }

    // Criterion is matched if confidence > 60% and has evidence
    const matched = confidence > 60 && evidence.length > 0;

    return {
      criterion,
      matched,
      evidence,
      confidence,
    };
  }

  /**
   * Extract key terms from criterion text
   */
  private extractKeyTerms(criterion: string): string[] {
    // Remove common words and extract meaningful terms
    const commonWords = new Set([
      'a',
      'an',
      'the',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'must',
      'can',
      'with',
      'for',
      'to',
      'of',
      'in',
      'on',
      'at',
      'by',
      'from',
      'up',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
    ]);

    return criterion
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 2 && !commonWords.has(word));
  }

  /**
   * Calculate term match score between key terms and text
   */
  private calculateTermMatchScore(keyTerms: string[], text: string): number {
    if (keyTerms.length === 0) return 0;

    const lowerText = text.toLowerCase();
    const matchedTerms = keyTerms.filter((term) => lowerText.includes(term));

    return matchedTerms.length / keyTerms.length;
  }

  /**
   * Calculate overall confidence from criterion matches
   */
  private calculateConfidence(matches: CriterionMatch[]): number {
    if (matches.length === 0) return 0;

    // Average confidence of all criteria
    const totalConfidence = matches.reduce((sum, match) => sum + match.confidence, 0);
    return Math.round(totalConfidence / matches.length);
  }

  /**
   * Generate review notes in markdown format
   */
  private generateReviewNotes(data: {
    matchedCriteria: string[];
    failedCriteria: string[];
    confidence: number;
    executionTime: number;
    sessionId: string;
    criterionMatches: CriterionMatch[];
  }): string {
    const lines: string[] = [];

    lines.push('## Auto-Completion Analysis');
    lines.push('');

    // Summary
    lines.push('### Summary');
    lines.push(`- **Confidence**: ${data.confidence}%`);
    lines.push(`- **Execution Time**: ${this.formatDuration(data.executionTime)}`);
    lines.push(`- **Session**: ${data.sessionId}`);
    lines.push(
      `- **Matched Criteria**: ${data.matchedCriteria.length}/${data.matchedCriteria.length + data.failedCriteria.length}`,
    );
    lines.push('');

    // Matched criteria
    if (data.matchedCriteria.length > 0) {
      lines.push('### ✅ Matched Criteria');
      for (const criterion of data.matchedCriteria) {
        const match = data.criterionMatches.find((m) => m.criterion === criterion);
        lines.push(`- ${criterion} (${Math.round(match?.confidence || 0)}% confidence)`);
        if (match?.evidence && match.evidence.length > 0) {
          lines.push(`  - Evidence: ${match.evidence.join(', ')}`);
        }
      }
      lines.push('');
    }

    // Failed criteria
    if (data.failedCriteria.length > 0) {
      lines.push('### ❌ Failed Criteria');
      for (const criterion of data.failedCriteria) {
        lines.push(`- ${criterion}`);
      }
      lines.push('');
    }

    // Recommendation
    lines.push('### Recommendation');
    if (data.confidence > 80) {
      lines.push('✅ **Task completion detected** - Marking as completed automatically.');
    } else if (data.confidence > 60) {
      lines.push(
        '⚠️ **Partial completion detected** - Manual review recommended before marking as completed.',
      );
    } else {
      lines.push('❌ **Insufficient evidence** - Task may require additional work or manual review.');
    }

    return lines.join('\n');
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Create a failed analysis result
   */
  private createFailedAnalysis(reason: string): CompletionAnalysis {
    return {
      completed: false,
      matchedCriteria: [],
      failedCriteria: [],
      confidence: 0,
      executionTime: 0,
      reviewNotes: `## Analysis Failed\n\n${reason}`,
    };
  }
}
