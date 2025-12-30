
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface TerminalLogProps {
  logs: LogEntry[];
}

const TerminalLog: React.FC<TerminalLogProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full glass rounded-xl border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          <span className="text-xs font-medium text-white/40 ml-2 mono">omniscout-core v2.1.0</span>
        </div>
        <span className="text-[10px] text-white/20 mono">COGNITIVE_LOGS</span>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 mono text-sm space-y-3"
      >
        {logs.length === 0 && (
          <div className="text-white/20 italic">Awaiting objective parameters...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 leading-relaxed group">
            <span className="text-white/20 shrink-0 select-none text-[10px] pt-1">{log.timestamp}</span>
            <div className="flex flex-col gap-1">
              <span className={`
                ${log.level === 'error' ? 'text-rose-400 font-bold' : ''}
                ${log.level === 'warn' ? 'text-amber-400' : ''}
                ${log.level === 'thought' ? 'text-violet-400 italic' : 'text-slate-300'}
              `}>
                {log.level === 'thought' && <span className="mr-2 opacity-50">#</span>}
                {log.message}
              </span>
              {log.step && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {log.step.startsWith('http') ? (
                    <a 
                      href={log.step} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded hover:bg-rose-500/20 transition-all flex items-center gap-1"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                      {new URL(log.step).hostname}
                    </a>
                  ) : (
                    <span className="text-[9px] text-white/10 uppercase tracking-[0.2em] font-bold">
                      [{log.step}]
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TerminalLog;
