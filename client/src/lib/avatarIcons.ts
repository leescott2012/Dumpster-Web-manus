/**
 * Curated icon-avatar set — alternative to uploading a profile photo.
 * Deliberately a small subset of the already-installed lucide-react (not a
 * new icon-library dependency; Phosphor/Iconify were evaluated and skipped
 * for the exact same reason: redundant with lucide-react already in use).
 */
import {
  Camera, Image, Star, Heart, Sun, Moon, Zap, Flame,
  Sparkles, Palette, Music, Coffee, Rocket, Feather, Aperture, Smile,
  type LucideIcon,
} from "lucide-react";

export interface AvatarIconDef {
  name: AvatarIconName;
  Icon: LucideIcon;
}

export const AVATAR_ICONS: AvatarIconDef[] = [
  { name: "camera", Icon: Camera },
  { name: "image", Icon: Image },
  { name: "star", Icon: Star },
  { name: "heart", Icon: Heart },
  { name: "sun", Icon: Sun },
  { name: "moon", Icon: Moon },
  { name: "zap", Icon: Zap },
  { name: "flame", Icon: Flame },
  { name: "sparkles", Icon: Sparkles },
  { name: "palette", Icon: Palette },
  { name: "music", Icon: Music },
  { name: "coffee", Icon: Coffee },
  { name: "rocket", Icon: Rocket },
  { name: "feather", Icon: Feather },
  { name: "aperture", Icon: Aperture },
  { name: "smile", Icon: Smile },
];

export type AvatarIconName =
  | "camera" | "image" | "star" | "heart" | "sun" | "moon" | "zap" | "flame"
  | "sparkles" | "palette" | "music" | "coffee" | "rocket" | "feather" | "aperture" | "smile";

export const AVATAR_COLORS: string[] = [
  "#f5c518", // Dumpster's admin accent — kept as the first/default option
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];
