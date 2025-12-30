
import React, { useState, useEffect, useRef } from 'react';
import { ICONS, MOCK_URLS } from './constants';
import { 
  ExecutionStatus, 
  ExecutionMode, 
  LogEntry, 
  AgentNode, 
  AgentEdge, 
  ExecutionState,
  BrowserStreamMessage
} from './types';
import { performScout } from './services/geminiService';
import { openAndAnalyze, RetryableError, InterventionError } from './activities/browserActivities';
import { browserManager } from './services/browser-manager';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { logger } from './lib/logger';
import TerminalLog from './components/TerminalLog';
import LiveBrowserView from './components/LiveBrowserView';
import AgentCanvas from './components/AgentCanvas';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<ExecutionMode>(ExecutionMode.CLOUD);
  const [isLiveSession, setIsLiveSession] = useState(false);
  const [execution, setExecution] = useState<ExecutionState>({
    id: '',
    status: ExecutionStatus.IDLE,
    mode: ExecutionMode.CLOUD,
    logs: [],
    nodes: [],
    edges: [],
    currentUrl: ''
  });

  const nextStartTimeRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    browserManager.init().catch(err => {
      logger.error({ err }, 'Critical Boot Failure: Swarm failed to initialize');
    });
  }, []);

  const addLog = (message: string, level: LogEntry['level'] = 'info', step?: string) => {
    logger.info({ step, message }, `AGENT_${level.toUpperCase()}`);

    setExecution(prev => ({
      ...prev,
      logs: [...prev.logs, {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions),
        level,
        message,
        step
      }]
    }));
  };

  const handleStreamMessage = (msg: BrowserStreamMessage) => {
    switch (msg.type) {
      case 'log_update':
        addLog(msg.message, msg.level, msg.step);
        break;
      case 'agent_thought':
        addLog(msg.thought, 'thought', 'REMOTE_BRAIN');
        break;
      case 'intervention_required':
        addLog(`INTERVENTION REQUIRED: ${msg.instructions}`, 'warn', 'ANTI_BOT');
        setExecution(prev => ({ ...prev, status: ExecutionStatus.PAUSED }));
        break;
    }
  };

  const handleStart = async () => {
    if (!prompt.trim()) return;

    const executionId = `OS-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    setExecution({
      id: executionId,
      status: ExecutionStatus.RUNNING,
      mode,
      logs: [],
      nodes: [
        { id: 'n0', label: 'Inception', type: 'start', status: 'active', position: { x: 50, y: 150 } }
      ],
      edges: [],
      currentUrl: 'https://scout.omni.ai'
    });

    addLog(`OmniScout Kernel: Session ${executionId} initiated.`, 'info', 'SYSTEM');
    addLog(`Cognitive objective set: "${prompt}"`, 'thought', 'BRAIN');

    addLog("Engaging wide-area reconnaissance via search grounding...", "info", "SEARCH");
    const scoutResult = await performScout(prompt);

    if (scoutResult.sources.length > 0) {
      addLog(`Reconnaissance successful. Found ${scoutResult.sources.length} primary targets.`, 'info', 'FOUND');
      
      const sourceNodes: AgentNode[] = scoutResult.sources.slice(0, 4).map((source, idx) => ({
        id: `node-${idx + 1}`,
        label: `Target: ${source.title}`,
        type: 'action',
        status: 'pending',
        position: { x: 230 + (idx * 180), y: 150 + (idx % 2 === 0 ? 0 : 60) }
      }));

      const edges: AgentEdge[] = [
        { id: 'e0', from: 'n0', to: sourceNodes[0].id },
        ...sourceNodes.slice(0, -1).map((n, i) => ({ id: `e${i+1}`, from: n.id, to: sourceNodes[i+1].id }))
      ];

      setExecution(prev => ({
        ...prev,
        nodes: [{ ...prev.nodes[0], status: 'success' }, ...sourceNodes],
        edges
      }));

      for (let i = 0; i < sourceNodes.length; i++) {
        const source = scoutResult.sources[i];
        const currentNodeId = `node-${i + 1}`;
        
        setExecution(prev => ({
          ...prev,
          currentUrl: source.uri,
          nodes: prev.nodes.map((n) => ({
            ...n,
            status: n.id === currentNodeId ? 'active' : (n.status === 'active' ? 'success' : n.status)
          }))
        }));

        addLog(`Triggering 'openAndAnalyze' activity for ${new URL(source.uri).hostname}`, 'info', 'TEMPORAL');
        
        let success = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!success && attempts < maxAttempts) {
          try {
            attempts++;
            const activityResult = await openAndAnalyze(executionId, source.uri, prompt);
            
            if (activityResult.success) {
              addLog(`Activity Complete. Resolved via ${activityResult.source.toUpperCase()}.`, 'info', 'SUCCESS');
              success = true;
            } else {
              addLog(`Activity failed: ${activityResult.message}`, 'warn', 'FAILURE');
              break; 
            }
          } catch (e: any) {
            if (e instanceof InterventionError) {
              addLog(`HUMAN INTERVENTION REQUIRED: ${e.message}`, 'error', 'INTERVENTION');
              setExecution(prev => ({
                ...prev,
                status: ExecutionStatus.PAUSED,
                nodes: prev.nodes.map(n => n.id === currentNodeId ? { ...n, status: 'failed' } : n)
              }));
              return;
            }
            
            if (e instanceof RetryableError && attempts < maxAttempts) {
              addLog(`Retryable error detected: ${e.message}. Attempt ${attempts}/${maxAttempts}...`, 'warn', 'RETRY');
              setExecution(prev => ({
                ...prev,
                nodes: prev.nodes.map(n => n.id === currentNodeId ? { ...n, status: 'retrying' } : n)
              }));
              await new Promise(r => setTimeout(r, 2000 * attempts));
            } else {
              addLog(`Fatal activity error: ${e.message}`, 'error', 'TEMPORAL_ERR');
              setExecution(prev => ({
                ...prev,
                nodes: prev.nodes.map(n => n.id === currentNodeId ? { ...n, status: 'failed' } : n)
              }));
              break;
            }
          }
        }
        
        await new Promise(r => setTimeout(r, 1000));
        if (execution.status === ExecutionStatus.PAUSED) break;
      }

      if (execution.status !== ExecutionStatus.PAUSED) {
        addLog(`Scouting complete. Synthesizing intelligence report...`, 'info', 'DONE');
        addLog(scoutResult.text, 'info', 'FINAL_REPORT');
        
        setExecution(prev => ({
          ...prev,
          status: ExecutionStatus.COMPLETED,
          nodes: prev.nodes.map(n => n.status === 'active' || n.status === 'retrying' ? { ...n, status: 'success' } : n)
        }));
      }
    } else {
      addLog("Reconnaissance failed to identify viable targets.", "error", "FAIL");
      setExecution(prev => ({ ...prev, status: ExecutionStatus.FAILED }));
    }
  };

  const toggleLiveVoice = async () => {
    if (isLiveSession) {
      if (liveSessionRef.current) liveSessionRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (inputAudioContextRef.current) inputAudioContextRef.current.close();
      setIsLiveSession(false);
      return;
    }

    try {
      addLog("Initializing real-time audio uplink...", "info", "LIVE");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const outputNode = audioContextRef.current.createGain();
      outputNode.connect(audioContextRef.current.destination);

      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: "You are OmniScout AI. You are a professional autonomous web agent coordinator.",
        },
        callbacks: {
          onopen: () => {
            setIsLiveSession(true);
            addLog("Autonomous voice link established.", "info", "VOICE_ON");
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const base64Data = encode(new Uint8Array(int16.buffer));
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const audioBuffer = await decodeAudioData(decode(audioData), audioContextRef.current, 24000, 1);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
            }
          },
          onerror: (err) => {
            logger.error({ err }, 'Live Audio Session Error');
            setIsLiveSession(false);
          },
          onclose: () => setIsLiveSession(false)
        }
      });

      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      logger.error({ err }, 'Mic access failed');
      addLog("Audio device error or permission denied.", "error", "MIC_ERROR");
    }
  };

  function encode(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function decode(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <aside className="w-64 border-r border-white/10 flex flex-col bg-zinc-900/50">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <ICONS.Layers />
          </div>
          <h1 className="text-lg font-bold tracking-tight">OmniScout<span className="text-rose-500">AI</span></h1>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {[
            { icon: <ICONS.Layout />, label: 'Dashboard', active: true },
            { icon: <ICONS.Cpu />, label: 'Agent Grid', active: false },
            { icon: <ICONS.Globe />, label: 'Scrape Hub', active: false },
            { icon: <ICONS.Activity />, label: 'Operations', active: false },
            { icon: <ICONS.Settings />, label: 'System', active: false },
          ].map((item, idx) => (
            <button key={idx} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${item.active ? 'bg-white/5 text-rose-400' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'}`}>
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="glass p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Neural Load</span>
              <span className="text-[10px] text-green-500 mono font-bold tracking-widest">STABLE</span>
            </div>
            <div className="space-y-2">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full bg-rose-500 transition-all duration-1000 ${execution.status === ExecutionStatus.RUNNING ? 'w-[92%]' : 'w-0'}`} />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/10">
                <div className={`w-2 h-2 rounded-full ${
                  execution.status === ExecutionStatus.RUNNING ? 'bg-rose-500 animate-pulse' : 
                  execution.status === ExecutionStatus.PAUSED ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' :
                  'bg-zinc-700'
                }`} />
                <span className={`text-[11px] font-bold tracking-tight uppercase ${execution.status === ExecutionStatus.PAUSED ? 'text-amber-500' : 'text-white/60'}`}>
                  {execution.status === ExecutionStatus.IDLE ? 'Standby' : execution.status}
                </span>
             </div>
             {execution.id && <span className="text-xs text-white/20 mono">{execution.id}</span>}
          </div>
          <div className="flex bg-zinc-900 p-1 rounded-lg border border-white/5">
             <button onClick={() => setMode(ExecutionMode.CLOUD)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${mode === ExecutionMode.CLOUD ? 'bg-rose-500 text-white shadow-lg' : 'text-white/40'}`}>Cloud Swarm</button>
             <button onClick={() => setMode(ExecutionMode.LOCAL)} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${mode === ExecutionMode.LOCAL ? 'bg-violet-500 text-white shadow-lg' : 'text-white/40'}`}>Local Ghost</button>
          </div>
        </header>

        <div className="flex-1 p-6 grid grid-cols-12 grid-rows-6 gap-6 overflow-hidden">
          <div className="col-span-12 lg:col-span-8 row-span-3">
            <AgentCanvas nodes={execution.nodes} edges={execution.edges} />
          </div>
          <div className="col-span-12 lg:col-span-4 row-span-6">
            <LiveBrowserView 
              url={execution.currentUrl} 
              isStreaming={execution.status === ExecutionStatus.RUNNING || execution.status === ExecutionStatus.PAUSED} 
              status={execution.nodes.find(n => n.status === 'active' || n.status === 'retrying')?.label || 'Cognitive standby...'} 
              executionId={execution.id}
              onMessage={handleStreamMessage}
            />
          </div>
          <div className="col-span-12 lg:col-span-8 row-span-3">
            <TerminalLog logs={execution.logs} />
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6 z-20">
          <div className="glass p-2 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-3">
             <button onClick={toggleLiveVoice} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isLiveSession ? 'bg-rose-500 text-white animate-pulse' : 'text-white/40 hover:text-rose-400 hover:bg-rose-500/10'}`}>
                <ICONS.Mic />
             </button>
             <input type="text" placeholder="Declare scouting objective..." value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleStart()} className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-white placeholder-white/20 py-3" />
             <button onClick={handleStart} disabled={execution.status === ExecutionStatus.RUNNING} className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-xl shadow-rose-500/20 disabled:opacity-50 ${execution.status === ExecutionStatus.RUNNING ? 'bg-zinc-800' : 'bg-rose-500 text-white hover:bg-rose-600'}`}>
                <ICONS.Send />
                {execution.status === ExecutionStatus.RUNNING ? 'Active' : 'Initiate'}
             </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
