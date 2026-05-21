import type {
  ButtonHTMLAttributes,
  MouseEvent,
  PointerEvent,
  TouchEvent,
} from "react";

type TapOpts = {
  onActivate: () => void;
  disabled?: boolean;
};

/**
 * Keeps focus on contenteditable while tapping toolbar chrome on mobile:
 * stop pointer/touch/mouse defaults + bubbling on down; fire action on up with duplicate-event guard.
 */
export function attachChromeProofTap({
  onActivate,
  disabled,
}: TapOpts): Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | "type"
  | "tabIndex"
  | "onTouchStart"
  | "onPointerDown"
  | "onMouseDown"
  | "onPointerUp"
  | "onTouchEnd"
  | "onClick"
> {
  let lastActivateMs = 0;

  const stop = (e: TouchEvent | PointerEvent | MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const fire = () => {
    if (disabled) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastActivateMs < 320) return;
    lastActivateMs = now;
    onActivate();
  };

  return {
    type: "button",
    tabIndex: -1,
    onTouchStart(e) {
      stop(e);
    },
    onPointerDown(e) {
      stop(e);
    },
    onMouseDown(e) {
      stop(e);
    },
    onPointerUp(e: PointerEvent<HTMLButtonElement>) {
      stop(e);
      if (e.pointerType === "mouse" && e.button !== 0) return;
      fire();
    },
    onTouchEnd(e: TouchEvent<HTMLButtonElement>) {
      stop(e);
      fire();
    },
    onClick(e: MouseEvent<HTMLButtonElement>) {
      stop(e);
      fire();
    },
  };
}
