export type SystemState = "idle" | "listening" | "thinking" | "speaking";

export const STATE_HEX: Record<SystemState, string> = {
  idle: "#c8a96e",
  listening: "#5b9bd5",
  thinking: "#f39c12",
  speaking: "#e8c882",
};

export const STATE_RGB: Record<SystemState, [number, number, number]> = {
  idle: [200, 169, 110],
  listening: [91, 155, 213],
  thinking: [243, 156, 18],
  speaking: [232, 200, 130],
};

export const STATE_LABELS: Record<SystemState, string> = {
  idle: "NEURAL MATRIX STANDBY",
  listening: "AUDIO INPUT PROCESSING",
  thinking: "COGNITIVE PROCESSING",
  speaking: "VOCAL OUTPUT ACTIVE",
};

export const STATE_SPEEDS: Record<SystemState, number> = {
  idle: 0.25,
  listening: 0.75,
  thinking: 2.0,
  speaking: 1.1,
};
