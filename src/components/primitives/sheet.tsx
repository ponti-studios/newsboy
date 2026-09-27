import {
  createContext,
  useContext,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";

import styles from "./sheet.module.css";
import { Slot } from "./slot";

const SheetContext = createContext<RefObject<HTMLDialogElement | null> | null>(null);

function useSheetContext(component: string) {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error(`<${component}> must be used inside <Sheet>`);
  return ctx;
}

/** Uses the native <dialog> element for focus trapping, Escape-to-close, and the backdrop for free. */
export function Sheet({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return <SheetContext.Provider value={dialogRef}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const dialogRef = useSheetContext("SheetTrigger");
  const triggerProps = { onClick: () => dialogRef.current?.showModal(), ...props };
  if (asChild) return <Slot {...triggerProps} />;
  return <button {...triggerProps} />;
}

export function SheetContent({ className, children, ...props }: HTMLAttributes<HTMLDialogElement>) {
  const dialogRef = useSheetContext("SheetContent");
  return (
    <dialog
      ref={dialogRef}
      className={[styles.dialog, className].filter(Boolean).join(" ")}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      {...props}
    >
      {children}
    </dialog>
  );
}

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[styles.header, className].filter(Boolean).join(" ")} {...props} />;
}

export function SheetTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={[styles.title, className].filter(Boolean).join(" ")} {...props} />;
}
