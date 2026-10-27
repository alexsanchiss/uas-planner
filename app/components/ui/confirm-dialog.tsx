"use client";

import React from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Info, Loader2, TriangleAlert } from 'lucide-react'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  /** Optional amber warning shown below the message */
  warning?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  loading?: boolean
}

// All colours come from theme tokens (tailwind.config.ts -> themes.css).
const variantStyles = {
  danger: {
    Icon: TriangleAlert,
    iconWrap: 'bg-danger-soft text-danger-text',
    confirmButton: 'bg-danger text-danger-fg hover:bg-danger-hover',
  },
  warning: {
    Icon: TriangleAlert,
    iconWrap: 'bg-warning-soft text-warning-text',
    confirmButton: 'bg-warning text-warning-fg hover:bg-warning-hover',
  },
  info: {
    Icon: Info,
    iconWrap: 'bg-info-soft text-info-text',
    confirmButton: 'bg-brand text-brand-fg hover:bg-brand-hover',
  },
} as const

/**
 * ConfirmDialog - confirmation dialog on Base UI AlertDialog.
 *
 * Focus trap, Escape to cancel, focus returns to the opener, scroll lock, role="alertdialog"
 * and aria-labelledby/-describedby come from the primitive. Initial focus lands on Cancel.
 * Escape and Cancel are ignored while `loading`. Clicking outside does not dismiss (alert semantics).
 *
 * Used for confirming destructive or important actions (delete, reset, cancel in-progress work).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm action',
  message,
  warning,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const { Icon, iconWrap, confirmButton } = variantStyles[variant]

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) onClose()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[10000] bg-overlay transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <AlertDialog.Viewport className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <AlertDialog.Popup
            initialFocus={cancelRef}
            className="w-full max-w-md overflow-hidden rounded-lg border border-line bg-surface text-fg shadow-theme-lg transition duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <AlertDialog.Title className="text-lg font-semibold text-fg">{title}</AlertDialog.Title>
                  <AlertDialog.Description className="mt-2 whitespace-pre-line text-sm text-fg-2">
                    {message}
                  </AlertDialog.Description>
                  {warning && (
                    <p className="mt-2 rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-sm font-medium text-warning-text">
                      {warning}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 bg-surface-2 px-6 py-4">
              <button
                ref={cancelRef}
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-md border border-line-2 bg-surface px-4 py-2 text-sm font-medium text-fg hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                aria-busy={loading || undefined}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${confirmButton}`}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {confirmLabel}
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

export default ConfirmDialog
