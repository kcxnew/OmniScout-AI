
import { proxyActivities, workflowInfo } from '@temporalio/workflow';
import type * as activities from '../activities/browserActivities';

// Define the activities proxy with robust timeout and retry configurations
const { openAndAnalyze } = proxyActivities<typeof activities>({
  startToCloseTimeout: '2 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    nonRetryableErrorTypes: ['InterventionError', 'FatalError']
  }
});

/**
 * OmniScout Agent Workflow
 * Orchestrates the multi-step process of scouting and analyzing target URLs.
 * This workflow is stateful and can survive worker failures.
 */
export async function agentWorkflow(params: { url: string, prompt: string }) {
  const { url, prompt } = params;
  const { workflowId } = workflowInfo();

  // In a real-world scenario, a workflow might involve multiple activities
  // (e.g., search, then multiple page navigations, then data synthesis).
  // Here we orchestrate the core 'openAndAnalyze' activity.
  const res = await openAndAnalyze(workflowId, url, prompt);

  if (!res.success) {
    // Workflow logic for handling non-success results.
    // This could trigger sub-workflows for human intervention
    // or alternate reconnaissance strategies.
    if (res.message?.includes('Captcha')) {
      // In a production system, we would pause and wait for a signal
      // from a human operator via workflow signals.
      throw new Error('WORKFLOW_PAUSED: Intervention required for Anti-bot');
    }
  }

  return { 
    status: 'completed', 
    executionId: workflowId,
    findings: res 
  };
}
