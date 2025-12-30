
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { BrowserStreamMessage } from '../types';

interface LiveBrowserViewProps {
  url: string;
  isStreaming: boolean;
  status: string;
  executionId?: string;
  onMessage?: (msg: BrowserStreamMessage) => void;
}

const LiveBrowserView: React.FC<LiveBrowserViewProps> = ({ url, isStreaming, status, executionId, onMessage }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [intervention, setIntervention] = useState<{ reason: string; instructions: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const drawFrame = (src: string) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
      
      // Add "Cognitive Overlay" scan lines
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvasRef.current!.height; i += 4) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvasRef.current!.width, i);
        ctx.stroke();
      }
    };
    img.src = src;
  };

  useEffect(() => {
    if (isStreaming && executionId) {
      const wsUrl = `wss://api.omniscout.ai/ws/connect/${executionId}`;
      setWsStatus('connecting');
      setIntervention(null);

      const connect = () => {
        try {
          const ws = new WebSocket(wsUrl);
          ws.binaryType = 'arraybuffer';
          wsRef.current = ws;

          ws.onopen = () => {
            setWsStatus('connected');
          };

          ws.onmessage = (event) => {
            // Handle Binary Frame (Legacy/Optimized fallback)
            if (event.data instanceof ArrayBuffer) {
              const blob = new Blob([event.data], { type: 'image/jpeg' });
              const url = URL.createObjectURL(blob);
              drawFrame(url);
              setTimeout(() => URL.revokeObjectURL(url), 100);
              return;
            }

            // Handle JSON Schema
            try {
              const msg: BrowserStreamMessage = JSON.parse(event.data);
              
              if (onMessage) onMessage(msg);

              switch (msg.type) {
                case 'browser_frame':
                  drawFrame(msg.imageBase64.startsWith('data:') ? msg.imageBase64 : `data:image/jpeg;base64,${msg.imageBase64}`);
                  break;
                case 'intervention_required':
                  setIntervention({ reason: msg.reason, instructions: msg.instructions });
                  break;
              }
            } catch (e) {
              console.error('Failed to parse WS message', e);
            }
          };

          ws.onclose = () => {
            setWsStatus('disconnected');
            startSimulation();
          };

          ws.onerror = () => {
            setWsStatus('disconnected');
          };
        } catch (e) {
          startSimulation();
        }
      };

      let simInterval: number;
      const startSimulation = () => {
        if (!isStreaming) return;
        let frameCount = 0;
        
        simInterval = window.setInterval(() => {
          frameCount++;
          
          // Randomly simulate a thought or intervention in the stream
          const roll = Math.random();
          if (roll < 0.05 && onMessage) {
            onMessage({
              type: 'agent_thought',
              executionId: executionId || 'sim',
              thought: 'Detecting potential shadow DOM entry point for extraction...'
            });
          } else if (roll > 0.98 && !intervention) {
            const intMsg: BrowserStreamMessage = {
              type: 'intervention_required',
              executionId: executionId || 'sim',
              reason: 'captcha',
              instructions: 'Verify human presence to continue scouting'
            };
            setIntervention({ reason: 'captcha', instructions: intMsg.instructions });
            if (onMessage) onMessage(intMsg);
          }

          // Mock Browser Frame
          const seed = Math.floor(Math.random() * 1000);
          const imgSrc = `https://picsum.photos/seed/${seed}/1200/800`;
          drawFrame(imgSrc);

        }, 2000);
      };

      connect();

      return () => {
        if (wsRef.current) wsRef.current.close();
        if (simInterval) clearInterval(simInterval);
      };
    } else {
      setWsStatus('disconnected');
      setIntervention(null);
    }
  }, [isStreaming, executionId, url]);

  return (
    <div className="flex flex-col h-full glass rounded-xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Browser Bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-zinc-900 border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
        </div>
        
        <div className="flex-1 flex items-center gap-2 bg-zinc-800/50 px-3 py-1 rounded-md border border-white/5 text-xs text-white/40">
          <ICONS.Globe />
          <span className="truncate">{url || 'about:blank'}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-tight uppercase 
            ${isStreaming ? (wsStatus === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-rose-500/10 text-rose-500 animate-pulse') : 'bg-white/5 text-white/40'}
          `}>
            <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? (wsStatus === 'connected' ? 'bg-green-500' : 'bg-rose-500') : 'bg-white/20'}`} />
            {isStreaming ? (wsStatus === 'connected' ? 'Live' : 'Syncing') : 'Offline'}
          </div>
        </div>
      </div>

      {/* Viewport Content */}
      <div className="relative flex-1 bg-zinc-950 overflow-hidden">
        <canvas 
          ref={canvasRef}
          width={1200}
          height={800}
          className={`w-full h-full object-cover transition-opacity duration-500 ${isStreaming ? 'opacity-100' : 'opacity-0'}`}
        />

        {isStreaming && (
          <>
            {intervention && (
              <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-8 z-30">
                <div className="max-w-xs w-full glass p-6 rounded-2xl border-rose-500/30 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-300">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Intervention Required</h4>
                    <p className="text-xs text-white/60 leading-relaxed">{intervention.instructions}</p>
                  </div>
                  <button onClick={() => setIntervention(null)} className="w-full py-2 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20">
                    Acknowledge
                  </button>
                </div>
              </div>
            )}

            <div className="absolute bottom-6 left-6 right-6">
              <div className="glass px-4 py-3 rounded-lg flex items-center justify-between border border-white/10 shadow-lg animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${intervention ? 'bg-amber-500 animate-pulse' : 'bg-rose-500 animate-ping'}`} />
                  <span className="text-xs font-medium text-white/80">{intervention ? 'Agent Paused: Human needed' : (status || 'Awaiting agent command...')}</span>
                </div>
                {wsStatus === 'connected' && (
                  <span className="text-[10px] mono text-white/20">Uplink: JSON_STREAM_v1</span>
                )}
              </div>
            </div>
          </>
        )}

        {!isStreaming && (
          <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-white/10 gap-4">
             <div className="p-8 rounded-full border-2 border-dashed border-white/5">
                <ICONS.Layout />
             </div>
             <p className="text-sm font-medium uppercase tracking-widest">Cognitive Engine Standby</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveBrowserView;
