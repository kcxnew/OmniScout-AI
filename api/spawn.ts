
import Fastify from 'fastify';
import { Connection, WorkflowClient } from '@temporalio/client';
import { logger } from '../lib/logger';

/**
 * OmniScout API - Agent Spawning Endpoint
 * This endpoint initiates a stateful Temporal workflow for an autonomous agent.
 */
const fastify = Fastify();

fastify.post('/api/v1/agent/spawn', async (req, reply) => {
  const { prompt, url, mode } = req.body as { 
    prompt: string, 
    url: string, 
    mode: 'cloud' | 'local' 
  };

  logger.info({ prompt, url, mode }, 'API: Received spawn request');

  try {
    // Connect to the Temporal cluster
    // In production, you would pass connection options (address, certificates, etc.)
    const connection = await Connection.connect();
    const client = new WorkflowClient({ connection });

    // Start the agent workflow asynchronously on the specified task queue
    const wf = await client.start('agentWorkflow', {
      taskQueue: 'omni-workers',
      workflowId: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      args: [{ url, prompt }],
    });

    logger.info({ executionId: wf.workflowId }, 'API: Workflow initiated successfully');

    return reply.code(200).send({ 
      executionId: wf.workflowId, 
      status: 'queued',
      message: 'Agent deployment sequence engaged.'
    });
  } catch (err) {
    logger.error({ err }, 'API: Failed to spawn agent workflow');
    return reply.code(500).send({ 
      error: 'Cognitive cluster uplink failed',
      details: (err as Error).message 
    });
  }
});

export default fastify;
