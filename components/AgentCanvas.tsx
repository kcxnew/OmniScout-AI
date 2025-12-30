
import React from 'react';
import { AgentNode, AgentEdge } from '../types';

interface AgentCanvasProps {
  nodes: AgentNode[];
  edges: AgentEdge[];
}

const AgentCanvas: React.FC<AgentCanvasProps> = ({ nodes, edges }) => {
  return (
    <div className="relative w-full h-full glass rounded-xl border border-white/10 overflow-hidden bg-[radial-gradient(#ffffff05_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="absolute top-4 left-4 flex flex-col gap-1">
        <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-violet-500" />
           Cognitive Graph
        </h3>
        <p className="text-[10px] text-white/20 mono">STATEFUL_LANGGRAPH_VM</p>
      </div>

      <svg className="w-full h-full pointer-events-none absolute inset-0">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.1)" />
          </marker>
        </defs>
        {edges.map(edge => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;
          
          return (
            <line
              key={edge.id}
              x1={fromNode.position.x + 80}
              y1={fromNode.position.y + 30}
              x2={toNode.position.x + 80}
              y2={toNode.position.y + 30}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          );
        })}
      </svg>

      {nodes.map(node => (
        <div
          key={node.id}
          style={{ 
            left: `${node.position.x}px`, 
            top: `${node.position.y}px`,
            transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          className={`absolute w-40 p-3 rounded-lg border flex flex-col gap-2 shadow-xl
            ${node.status === 'active' ? 'bg-violet-500/10 border-violet-500/50 neon-border-violet' : 
              node.status === 'retrying' ? 'bg-amber-500/10 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' :
              node.status === 'success' ? 'bg-green-500/5 border-green-500/20' : 
              node.status === 'failed' ? 'bg-rose-500/10 border-rose-500/50' :
              'bg-zinc-900/80 border-white/10 opacity-60'
            }
          `}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[8px] font-bold uppercase tracking-tighter
              ${node.type === 'start' ? 'text-blue-400' : 
                node.type === 'condition' ? 'text-amber-400' : 
                node.type === 'end' ? 'text-rose-400' : 'text-slate-400'
              }
            `}>
              {node.type}
            </span>
            {node.status === 'active' && (
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
            )}
            {node.status === 'retrying' && (
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            )}
            {node.status === 'success' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {node.status === 'failed' && (
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            )}
          </div>
          <span className="text-[10px] font-medium text-white/80 line-clamp-2 leading-tight">
            {node.label}
          </span>
          {node.status === 'active' && (
             <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 w-1/3 animate-[loading_1.5s_infinite]" />
             </div>
          )}
          {node.status === 'retrying' && (
             <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 w-full animate-pulse" />
             </div>
          )}
        </div>
      ))}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default AgentCanvas;
