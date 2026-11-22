export const COLLAPSED = { width: 320, height: 36 };
export const EXPANDED = { width: 680, height: 180 };

export function notchGeometry(width: number, height: number) {
  const progress = Math.max(0, Math.min(1, (width - COLLAPSED.width) / (EXPANDED.width - COLLAPSED.width)));
  const mix = (from: number, to: number) => from + (to - from) * progress;
  const left = mix(20, 52.8);
  const right = width - left;
  const shoulder = mix(18, 24);
  const radius = mix(21, 30);
  const bottom = height - mix(1, 10);
  const edge = `M${right + shoulder} 0 A${shoulder} ${shoulder} 0 0 0 ${right} ${shoulder} V${bottom - radius} Q${right} ${bottom} ${right - radius} ${bottom} H${left + radius} Q${left} ${bottom} ${left} ${bottom - radius} V${shoulder} A${shoulder} ${shoulder} 0 0 0 ${left - shoulder} 0`;
  return { progress, edge, shape: `${edge} Z` };
}

export function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
