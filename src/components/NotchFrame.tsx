import { useLayoutEffect, useState, type ReactNode } from "react";
import { NotchSurface } from "./NotchSurface";
import { notchGeometry, smoothstep } from "./notchGeometry";

type NotchFrameProps = {
  children: ReactNode;
  collapsed: ReactNode;
  settledOpen?: boolean;
  size: { width: number; height: number };
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
};

export function NotchFrame({ children, collapsed, settledOpen = true, size, ...events }: NotchFrameProps) {
  const [shellPainted, setShellPainted] = useState(false);
  const [mountedContent, setMountedContent] = useState<ReactNode>(null);

  useLayoutEffect(() => {
    if (!settledOpen) {
      setShellPainted(false);
      return;
    }
    // Leave a paint for the settled shell before mounting the page.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setShellPainted(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [settledOpen]);

  const showContent = settledOpen && shellPainted;
  useLayoutEffect(() => {
    // Keep the last displayed page mounted so folding the notch preserves drafts.
    if (showContent) setMountedContent(children);
  }, [children, showContent]);

  const { progress, shape } = notchGeometry(size.width, size.height);
  const collapsedOpacity = settledOpen ? 0 : 1 - smoothstep(progress / 0.28);
  return <main
    className="relative mx-auto overflow-hidden font-sans text-[#eef4fa]"
    style={{ ...size, clipPath: `path('${shape}')` }}
    {...events}
  >
    <NotchSurface width={size.width} height={size.height} />
    <div
      className={`absolute left-1/2 top-0 z-20 h-[180px] w-[680px] -translate-x-1/2 overflow-hidden rounded-b-[30px] transition-opacity ease-out motion-reduce:transition-none ${showContent ? "opacity-100 duration-150" : "opacity-0 duration-75"}`}
      inert={!showContent}
      aria-hidden={!showContent}
    >{showContent ? children : mountedContent}</div>
    <div
      className="absolute left-1/2 top-0 z-20 h-9 w-[280px] -translate-x-1/2"
      style={{ opacity: collapsedOpacity, visibility: collapsedOpacity === 0 ? "hidden" : "visible" }}
      inert={settledOpen || progress > 0.01}
      aria-hidden={collapsedOpacity === 0}
    >{collapsed}</div>
  </main>;
}
