export type SystemState = "idle" | "listening" | "thinking" | "speaking";

// Iron Man / Stark Industries gold–black palette
export const GOLD        = "#D4AF37" as const;
export const GOLD_BRIGHT = "#FFD700" as const;
export const GOLD_DIM    = "#856A1E" as const;
export const GOLD_DARK   = "#B8960C" as const;
export const BLACK       = "#000000" as const;
export const SURFACE     = "#050400" as const;

export const STATE_HEX: Record<SystemState, string> = {
  idle:      GOLD_DIM,    // dim — standby
  listening: GOLD,        // standard — active input
  thinking:  GOLD_BRIGHT, // bright — cognitive processing
  speaking:  GOLD,        // standard — vocal output
};

export const STATE_RGB: Record<SystemState, [number, number, number]> = {
  idle:      [133, 106,  30],
  listening: [212, 175,  55],
  thinking:  [255, 215,   0],
  speaking:  [212, 175,  55],
};

export const STATE_LABELS: Record<SystemState, string> = {
  idle:      "NEURAL MATRIX STANDBY",
  listening: "AUDIO INPUT PROCESSING",
  thinking:  "COGNITIVE PROCESSING",
  speaking:  "VOCAL OUTPUT ACTIVE",
};

export const STATE_SPEEDS: Record<SystemState, number> = {
  idle:      0.18,
  listening: 0.70,
  thinking:  1.90,
  speaking:  1.05,
};

export const STATE_INTENSITY: Record<SystemState, number> = {
  idle:      0.30,
  listening: 0.80,
  thinking:  1.00,
  speaking:  0.88,
};
