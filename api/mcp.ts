
import Fastify from 'fastify';
import { Connection, WorkflowClient } from '@temporalio/client';
import { logger } from '../lib/logger';

/**
 * OmniScout MCP Endpoint
 * Implementation of the Model Context Protocol bridge for autonomous tools.
 */
const fastify = Fastify();

fastify.post('/mcp/call', async (req, reply) => {
  const { tool, args } = req.body as { tool: string; args: any };
  
  logger.info({ tool, args, step: 'MCP_TOOL_INVOCATION' }, 'Processing external tool request via MCP');

  try {
    // Establishing connection to the Temporal Control Plane
    const connection = await Connection.connect();
    const client = new WorkflowClient({ connection });

    switch (tool) {
      case 'omniscout_navigate': {
        const { url, description = 'Autonomous navigation and structural analysis' } = args;
        
        if (!url) {
          logger.warn({ tool }, 'MCP: Missing required argument [url]');
          return reply.code(400).send({ error: 'Tool omniscout_navigate requires a valid "url" argument.' });
        }

        // Trigger the stateful agent workflow
        // This workflow manages navigation, retries, and cognitive processing
        const wf = await client.start('agentWorkflow', {
          taskQueue: 'omni-workers',
          workflowId: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          args: [{ url, prompt: description }],
        });

        logger.info({ executionId: wf.workflowId, url }, 'MCP: Agent workflow spawned successfully');

        return reply.send({ 
          ok: true, 
          executionId: wf.workflowId,
          status: 'initiated',
          message: `OmniScout agent dispatched to target: ${url}. Monitoring via ${wf.workflowId}` 
        });
      }

      case 'omniscout_status': {
        const { executionId } = args;
        if (!executionId) {
          return reply.code(400).send({ error: 'Argument "executionId" is required for status checks.' });
        }
        
        try {
          const handle = client.getHandle(executionId);
          const desc = await handle.describe();
          
          return reply.send({
            ok: true,
            executionId,
            status: desc.status.name,
            startTime: desc.startTime,
            isCompleted: desc.status.name === 'COMPLETED'
          });
        } catch (err) {
          return reply.code(404).send({ error: 'Execution ID not found in current control plane' });
        }
      }

      default:
        logger.error({ tool }, 'MCP: Requested tool not supported by current kernel');
        return reply.code(400).send({ 
          error: 'unsupported tool',
          supportedTools: ['omniscout_navigate', 'omniscout_status'],
          documentation: 'https://docs.omniscout.ai/mcp'
        });
    }
  } catch (err) {
    logger.error({ err, tool }, 'MCP: Fatal execution error during control plane handshake');
    return reply.code(500).send({ 
      error: 'Control plane communication failure',
      details: (err as Error).message 
    });
  }
});

export default fastify;
