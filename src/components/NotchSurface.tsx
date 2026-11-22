import { useId } from "react";

import { notchGeometry } from "./notchGeometry";

type NotchSurfaceProps = { width: number; height: number };

export function NotchSurface({ width, height }: NotchSurfaceProps) {
  const { edge } = notchGeometry(width, height);
  const id = useId().replace(/:/g, "");
  const fill = `${id}-fill`;
  const light = `${id}-light`;
  const clip = `${id}-clip`;
  const bloom = `${id}-bloom`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[19] h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path id={`${id}-shape`} d={`${edge} Z`} />
        <clipPath id={clip}>
          <use href={`#${id}-shape`} />
        </clipPath>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#081522" />
          <stop offset="0.55" stopColor="#07111b" />
          <stop offset="1" stopColor="#040c14" />
        </linearGradient>
        <radialGradient id={light} cx="50%" cy="0%" r="70%">
          <stop offset="0" stopColor="#2f5c80" stopOpacity=".25" />
          <stop offset="1" stopColor="#2f5c80" stopOpacity="0" />
        </radialGradient>
        <filter id={bloom} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>

      <use href={`#${id}-shape`} fill={`url(#${fill})`} />
      <use href={`#${id}-shape`} fill={`url(#${light})`} />

      {/* Clip every highlight to the same silhouette. The edge omits the top line. */}
      <g clipPath={`url(#${clip})`} fill="none">
        <path d={edge} stroke="#14768d" strokeOpacity=".35" strokeWidth="2" />
        <path
          className="animate-electric-outline motion-reduce:animate-none"
          d={edge} pathLength="100" stroke="#43e9ff" strokeWidth="7"
          strokeDasharray="5 95" strokeLinecap="round" opacity=".65"
          filter={`url(#${bloom})`}
        />
        <path
          className="animate-electric-outline motion-reduce:animate-none"
          d={edge} pathLength="100" stroke="#d8fcff" strokeWidth="2"
          strokeDasharray="5 95" strokeLinecap="round"
        />
        <path
          className="animate-electric-outline [animation-delay:-1.7s] motion-reduce:animate-none"
          d={edge} pathLength="100" stroke="#61f3ff" strokeWidth="2"
          strokeDasharray="2 98" strokeLinecap="round" opacity=".7"
        />
      </g>
    </svg>
  );
}
