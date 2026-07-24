import type { ReactNode } from "react";

const ICONS = {
  sound: "◖))",
  muted: "◖×",
  pickaxe: "⌁",
  cloud: "☁",
  pause: "Ⅱ",
  dynamite: "!",
  daily: "☀",
  endless: "∞",
  help: "?",
  achievement: "★",
  settings: "⚙",
} as const;

export type GameIconName = keyof typeof ICONS;

export function GameIcon({
  name,
  label,
}: {
  name: GameIconName;
  label?: string;
}): ReactNode {
  return (
    <span
      className={`game-icon game-icon-${name}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {ICONS[name]}
    </span>
  );
}
