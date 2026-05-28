export interface Message {
  id: string;
  sender: 'user' | 'jarvis';
  text: string;
  timestamp: string;
  isError?: boolean;
}

export interface Task {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  logs: string[];
  summary?: string;
  agentType: 'researcher' | 'coder' | 'social' | 'analyst';
  timestamp: string;
}

export interface SystemMetrics {
  coreTemp: number;
  arcReactorPercent: number;
  cpuUsage: number;
  memoryUsage: number;
  synapseLatency: number;
  satelliteStatus: 'secured' | 'syncing' | 'offline';
}

export interface JarvisSettings {
  userName: string;
  accent: string;
  voicePitch: 'Deep Butler' | 'High Tech Voice' | 'Robotic Guard' | 'Standard';
  wakeWordActive: boolean;
  audioEnabled: boolean;
  colorTheme: 'arc-blue' | 'reactor-orange' | 'matrix-green' | 'crimson-alert';
}
