
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
    <div className="flex flex-col h-full glass rounded-xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500/50 animate-pulse" />
          <span className="text-xs font-medium text-white/30 ml-2 mono">antigravity-kernel v3.0.0-omega</span>
        </div>
        <span className="text-[10px] text-white/10 mono">ORBITAL_TELEMETRY</span>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 mono text-sm space-y-3"
      >
        {logs.length === 0 && (
          <div className="text-white/10 italic">Waiting for orbital insertion parameters...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 leading-relaxed group">
            <span className="text-white/10 shrink-0 select-none text-[10px] pt-1">{log.timestamp}</span>
            <div className="flex flex-col gap-1">
              <span className={`
                ${log.level === 'error' ? 'text-rose-400 font-bold' : ''}
                ${log.level === 'warn' ? 'text-amber-400' : ''}
                ${log.level === 'thought' ? 'text-cyan-400 italic' : 'text-slate-400'}
              `}>
                {log.level === 'thought' && <span className="mr-2 opacity-30">≋</span>}
                {log.message}
              </span>
              {log.step && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {log.step.startsWith('http') ? (
                    <a 
                      href={log.step} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] bg-cyan-500/5 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded hover:bg-cyan-500/10 transition-all flex items-center gap-1"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                      {new URL(log.step).hostname}
                    </a>
                  ) : (
                    <span className="text-[9px] text-white/10 uppercase tracking-[0.3em] font-bold bg-white/5 px-2 py-0.5 rounded">
                      {log.step}
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
