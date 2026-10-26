'use client'

import { useId, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { CalendarClock, Loader2, Shuffle } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { fromLocalInput, toLocalInput } from './lib'
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, POPUP, TimezoneHint } from './SchedulePopover'

interface FolderProps {
  folderName: string
  min: string | null
  max: string | null
  planCount: number
  /** Saves the window (null = clear). */
  onSaveWindow: (min: string | null, max: string | null) => Promise<void>
  /** Ask to randomize every plan of the folder inside the saved window. */
  onRandomize: () => void
}

/** Dev: per-folder min / max window and "Randomize times". */
export function FolderSchedulePopover({ folderName, min, max, planCount, onSaveWindow, onRandomize }: FolderProps) {
  const { t } = useI18n()
  const pa = t.planAuth.schedule
  const [open, setOpen] = useState(false)
  const minId = useId()
  const maxId = useId()
  const [minDraft, setMinDraft] = useState(toLocalInput(min))
  const [maxDraft, setMaxDraft] = useState(toLocalInput(max))
  const [saving, setSaving] = useState(false)

  const invalid = !!minDraft && !!maxDraft && new Date(minDraft) >= new Date(maxDraft)
  const saved = !!min && !!max && new Date(min) < new Date(max)

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setMinDraft(toLocalInput(min))
          setMaxDraft(toLocalInput(max))
        }
      }}
    >
      <Popover.Trigger className={BTN_SECONDARY}>
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        {pa.folderTrigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="z-40" sideOffset={4} align="end">
          <Popover.Popup className={POPUP}>
            <Popover.Title className="text-sm font-semibold">{interpolate(pa.folderTitle, { name: folderName })}</Popover.Title>
            <Popover.Description className="mb-3 mt-1 text-xs text-fg-2">{pa.folderHint}</Popover.Description>
            <div className="space-y-3">
              <div>
                <label htmlFor={minId} className="mb-1 block text-sm font-medium text-fg-2">
                  {pa.min}
                </label>
                <input id={minId} type="datetime-local" value={minDraft} onChange={(e) => setMinDraft(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label htmlFor={maxId} className="mb-1 block text-sm font-medium text-fg-2">
                  {pa.max}
                </label>
                <input id={maxId} type="datetime-local" value={maxDraft} onChange={(e) => setMaxDraft(e.target.value)} className={INPUT} />
              </div>
              <TimezoneHint />
              {invalid && (
                <p role="alert" className="text-xs text-danger-text">
                  {pa.windowInvalid}
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={saving || invalid}
                onClick={async () => {
                  setSaving(true)
                  try {
                    await onSaveWindow(fromLocalInput(minDraft) || null, fromLocalInput(maxDraft) || null)
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {pa.saveWindow}
              </button>
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={!saved || planCount === 0 || saving}
                title={!saved ? pa.randomizeNeedsWindow : undefined}
                onClick={() => {
                  setOpen(false)
                  onRandomize()
                }}
              >
                <Shuffle className="h-4 w-4" aria-hidden="true" />
                {pa.randomize}
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
