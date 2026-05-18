"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clampSidebarToggleY,
  useSidebarTogglePositionStore,
} from "@/stores/sidebarTogglePositionStore";

const DRAG_CLICK_THRESHOLD_PX = 3;

type Props = {
  isSidebarOpen: boolean;
  onToggle: () => void;
  leftPx: number;
  ariaLabelShow: string;
  ariaLabelHide: string;
  titleShow: string;
  titleHide: string;
};

export function PcSidebarToggleButton({
  isSidebarOpen,
  onToggle,
  leftPx,
  ariaLabelShow,
  ariaLabelHide,
  titleShow,
  titleHide,
}: Props) {
  const yCommitted = useSidebarTogglePositionStore((s) => s.yPx);
  const setYCommitted = useSidebarTogglePositionStore((s) => s.setY);
  const hydrate = useSidebarTogglePositionStore((s) => s.hydrate);
  const clampToViewport = useSidebarTogglePositionStore((s) => s.clampToViewport);

  const [previewY, setPreviewY] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const startClientYRef = useRef(0);
  const startYPxRef = useRef(0);
  const previewYRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onResize = () => clampToViewport();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampToViewport]);

  const displayTop = previewY ?? yCommitted;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerDownRef.current = { x: e.clientX, y: e.clientY };
      startClientYRef.current = e.clientY;
      startYPxRef.current = yCommitted;
      previewYRef.current = null;
      setDragging(false);
      setPreviewY(null);
    },
    [yCommitted],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const down = pointerDownRef.current;
    if (!down) return;
    const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (dist <= DRAG_CLICK_THRESHOLD_PX) return;
    setDragging(true);
    const dy = e.clientY - startClientYRef.current;
    const y = clampSidebarToggleY(startYPxRef.current + dy);
    previewYRef.current = y;
    setPreviewY(y);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const down = pointerDownRef.current;
      pointerDownRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }

      if (!down) return;

      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (dist < DRAG_CLICK_THRESHOLD_PX) {
        previewYRef.current = null;
        setPreviewY(null);
        setDragging(false);
        onToggle();
        return;
      }

      const finalY =
        previewYRef.current ??
        clampSidebarToggleY(startYPxRef.current + (e.clientY - startClientYRef.current));
      previewYRef.current = null;
      setYCommitted(finalY);
      setPreviewY(null);
      setDragging(false);
    },
    [onToggle, setYCommitted],
  );

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    pointerDownRef.current = null;
    previewYRef.current = null;
    setPreviewY(null);
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <button
      type="button"
      aria-expanded={isSidebarOpen}
      aria-label={isSidebarOpen ? ariaLabelHide : ariaLabelShow}
      title={isSidebarOpen ? titleHide : titleShow}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={cn(
        "pointer-events-auto absolute z-[80] hidden h-9 w-9 touch-none select-none items-center justify-center rounded-md border border-zinc-700 bg-zinc-950 text-zinc-300 shadow-md transition-[left] duration-300 ease-out hover:border-cyan-500/45 hover:text-cyan-200 md:flex",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      style={{ left: leftPx, top: displayTop }}
    >
      {isSidebarOpen ? <PanelLeftClose size={18} strokeWidth={1.75} /> : <PanelLeft size={18} strokeWidth={1.75} />}
    </button>
  );
}
