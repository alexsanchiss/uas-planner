"use client";

import React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Use 'wide' for map modals that need more horizontal space */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  /** Tailwind z-index class for the overlay (default: 'z-50') */
  overlayZIndex?: string;
}

const maxWidthClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-[95vw]',
};

/**
 * Modal on Base UI Dialog: focus trap, Escape to close, focus returns to the opener,
 * page scroll lock, role="dialog" + aria-labelledby (from the title). Styled with theme tokens only.
 * Clicking outside does NOT close it (same as before: forms and maps must not be lost by a stray click).
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  maxWidth = 'md',
  overlayZIndex = 'z-50',
}) => {
  const widthClass = maxWidthClasses[maxWidth] || 'max-w-md';
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      disablePointerDismissal
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={`fixed inset-0 ${overlayZIndex} bg-overlay transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0`}
        />
        <Dialog.Viewport className={`fixed inset-0 ${overlayZIndex} flex items-center justify-center p-4`}>
          <Dialog.Popup
            aria-label={title ? undefined : "Dialog"}
            className={`relative w-full ${widthClass} max-h-[90vh] overflow-y-auto rounded-lg border border-line bg-surface p-6 text-fg-2 shadow-theme-lg transition duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0`}
          >
            <Dialog.Close
              aria-label="Close"
              className="absolute right-2 top-2 rounded-md p-1 text-muted hover:bg-hover hover:text-fg"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
            {title && (
              <Dialog.Title className="mb-4 pr-8 text-xl font-bold text-fg">{title}</Dialog.Title>
            )}
            <div>{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
