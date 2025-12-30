
import React from 'react';
import { AgentNode, AgentEdge } from '../types';

interface AgentCanvasProps {
  nodes: AgentNode[];
  edges: AgentEdge[];
}

const AgentCanvas: React.FC<AgentCanvasProps> = ({ nodes, edges }) => {
  return (
    <div className="relative w-full h-full glass rounded-xl border border-white/5 overflow-hidden bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:32px_32px]">
      <div className="absolute top-4 left-4 flex flex-col gap-1">
        <h3 className="text-xs font-bold text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
           Cognitive Network
        </h3>
        <p className="text-[10px] text-white/10 mono">ZERO_G_ORCHESTRATOR</p>
      </div>

      <svg className="w-full h-full pointer-events-none absolute inset-0">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(34,211,238,0.2)" />
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
              stroke="rgba(34,211,238,0.05)"
              strokeWidth="1.5"
              markerEnd="url(#arrowhead)"
            />
          );
        })}
      </svg>

      {nodes.map((node, i) => (
        <div
          key={node.id}
          style={{ 
            left: `${node.position.x}px`, 
            top: `${node.position.y}px`,
            transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
            animationDelay: `${i * 0.2}s`
          }}
          className={`absolute w-40 p-3 rounded-lg border flex flex-col gap-2 shadow-2xl backdrop-blur-md floating
            ${node.status === 'active' ? 'bg-cyan-500/5 border-cyan-500/40 neon-border-cyan' : 
              node.status === 'retrying' ? 'bg-amber-500/5 border-amber-500/40' :
              node.status === 'success' ? 'bg-indigo-500/5 border-indigo-500/20' : 
              node.status === 'failed' ? 'bg-rose-500/5 border-rose-500/40' :
              'bg-zinc-950/40 border-white/5 opacity-40'
            }
          `}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[8px] font-bold uppercase tracking-widest
              ${node.type === 'start' ? 'text-cyan-400' : 
                node.type === 'condition' ? 'text-amber-400' : 
                node.type === 'end' ? 'text-indigo-400' : 'text-slate-500'
              }
            `}>
              {node.type}
            </span>
            {node.status === 'active' && (
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            )}
            {node.status === 'success' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span className="text-[10px] font-medium text-white/70 line-clamp-2 leading-tight">
            {node.label}
          </span>
          {node.status === 'active' && (
             <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 w-1/3 animate-[loading_2s_infinite]" />
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
