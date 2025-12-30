
export enum ExecutionStatus {
  IDLE = 'IDLE',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
  INTERVENTION = 'INTERVENTION'
}

export enum ExecutionMode {
  CLOUD = 'Cloud Swarm',
  LOCAL = 'Local Ghost'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'thought';
  message: string;
  step?: string;
}

export interface AgentNode {
  id: string;
  label: string;
  type: 'start' | 'action' | 'condition' | 'end';
  status: 'pending' | 'active' | 'success' | 'failed' | 'retrying';
  position: { x: number; y: number };
}

export interface AgentEdge {
  id: string;
  from: string;
  to: string;
}

export interface ExecutionState {
  id: string;
  status: ExecutionStatus;
  mode: ExecutionMode;
  logs: LogEntry[];
  nodes: AgentNode[];
  edges: AgentEdge[];
  currentUrl: string;
}

export type BrowserStreamMessage = 
  | { type: 'log_update'; executionId: string; timestamp: string; level: 'info' | 'warn' | 'error'; message: string; step?: string }
  | { type: 'agent_thought'; executionId: string; thought: string }
  | { type: 'browser_frame'; executionId: string; frameIndex: number; imageBase64: string }
  | { type: 'intervention_required'; executionId: string; reason: 'captcha' | 'auth' | 'input'; instructions: string };
