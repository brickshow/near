import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { NotchSurface } from "./NotchSurface";
import { COLLAPSED, notchGeometry, smoothstep } from "./notchGeometry";

type NotchFrameProps = {
  children: ReactNode;
  collapsed: ReactNode;
  previewSize?: { width: number; height: number };
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
};

export function NotchFrame({ children, collapsed, previewSize, ...events }: NotchFrameProps) {
  const root = useRef<HTMLElement>(null);
  const [size, setSize] = useState(COLLAPSED);
  useLayoutEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // ResizeObserver runs before paint. Update the silhouette in that same
      // paint, rather than stretching last frame's SVG into the new viewport.
      flushSync(() => setSize({ width, height }));
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  const { progress, shape } = notchGeometry(size.width, size.height);
  // Let the notch finish most of its size change before revealing the page.
  // This avoids text and controls appearing clipped while the frame is still opening.
  const expandedOpacity = smoothstep((progress - 0.68) / 0.3);
  const collapsedOpacity = 1 - expandedOpacity;
  return <main
    ref={root}
    className="relative mx-auto h-full w-full overflow-hidden font-sans text-[#eef4fa]"
    style={{ ...previewSize, clipPath: `path('${shape}')` }}
    {...events}
  >
    <NotchSurface width={size.width} height={size.height} />
    <div
      className="absolute left-1/2 top-0 z-20 h-[180px] w-[680px] -translate-x-1/2 overflow-hidden rounded-b-[30px]"
      style={{ opacity: expandedOpacity, visibility: expandedOpacity === 0 ? "hidden" : "visible", willChange: "opacity" }}
      inert={progress < 0.99}
      aria-hidden={expandedOpacity === 0}
    >{children}</div>
    <div
      className="absolute left-1/2 top-0 z-20 h-9 w-[280px] -translate-x-1/2"
      style={{ opacity: collapsedOpacity, visibility: collapsedOpacity === 0 ? "hidden" : "visible" }}
      inert={progress > 0.01}
      aria-hidden={collapsedOpacity === 0}
    >{collapsed}</div>
  </main>;
}
