import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import styles from "./popover.module.css";
import { Slot } from "./slot";

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(component: string) {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error(`<${component}> must be used inside <Popover>`);
  return ctx;
}

export function Popover({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <PopoverContext.Provider value={{ open, setOpen, wrapperRef }}>
      <div ref={wrapperRef} className={styles.wrapper}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export function PopoverTrigger({
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { open, setOpen } = usePopoverContext("PopoverTrigger");
  const triggerProps = { "aria-expanded": open, onClick: () => setOpen(!open), ...props };
  if (asChild) return <Slot {...triggerProps} />;
  return <button {...triggerProps} />;
}

export function PopoverContent({
  align = "center",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end" }) {
  const { open } = usePopoverContext("PopoverContent");
  if (!open) return null;
  const alignClass =
    align === "end" ? styles.alignEnd : align === "start" ? styles.alignStart : styles.alignCenter;
  return (
    <div
      role="dialog"
      className={[styles.content, alignClass, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
