export interface Task {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  logs: string[];
  summary?: string;
  agentType: 'researcher' | 'coder' | 'social' | 'analyst';
  timestamp: string;
}

export interface GeniusSettings {
  userName: string;
  colorTheme: 'arc-blue' | 'reactor-orange' | 'matrix-green' | 'crimson-alert';
  audioEnabled: boolean;
  wakeWordActive: boolean;
  voicePitch: 'Deep Butler' | 'High Tech Voice' | 'Robotic Guard' | 'Standard';
}
