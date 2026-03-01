import type { WorkflowAPI } from '../../preload/apis/workflow';

declare global {
  interface Window {
    workflowAPI: WorkflowAPI;
  }
}

export type { WorkflowAPI };
