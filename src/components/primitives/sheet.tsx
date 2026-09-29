import {
  createContext,
  useContext,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";

import styles from "./sheet.module.css";
import { Slot } from "./slot";

interface SheetContextValue {
  dialogRef: RefObject<HTMLDialogElement | null>;
  /** Id `SheetTitle` renders onto its heading, so `SheetContent` can point
   *  the dialog's `aria-labelledby` at it — a native `<dialog>` has no
   *  accessible name on its own. */
  titleId: string;
}

const SheetContext = createContext<SheetContextValue | null>(null);

function useSheetContext(component: string) {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error(`<${component}> must be used inside <Sheet>`);
  return ctx;
}

/** Uses the native <dialog> element for focus trapping, Escape-to-close, and the backdrop for free. */
export function Sheet({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return <SheetContext.Provider value={{ dialogRef, titleId }}>{children}</SheetContext.Provider>;
}

export function SheetTrigger({
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { dialogRef } = useSheetContext("SheetTrigger");
  const triggerProps = { onClick: () => dialogRef.current?.showModal(), ...props };
  if (asChild) return <Slot {...triggerProps} />;
  return <button {...triggerProps} />;
}

export function SheetContent({ className, children, ...props }: HTMLAttributes<HTMLDialogElement>) {
  const { dialogRef, titleId } = useSheetContext("SheetContent");
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
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
  const { titleId } = useSheetContext("SheetTitle");
  return <h2 id={titleId} className={[styles.title, className].filter(Boolean).join(" ")} {...props} />;
}
