'use client'

import { useI18n } from '@/app/i18n'
import type { FolderSummary } from '@/app/hooks/useFolders'
import { FolderSchedulePopover } from './FolderSchedulePopover'
import { SELECT_KEYS, type SelectKey } from './lib'
import { BTN_SECONDARY } from './SchedulePopover'

interface Props {
  folder: FolderSummary
  planCount: number
  canDeselect: boolean
  onSelectBy: (key: SelectKey) => void
  onDeselect: () => void
  onSaveWindow: (min: string | null, max: string | null) => Promise<void>
  onRandomize: () => void
}

/** Dev: tick the folder's plans by status, untick them, and the per-folder time window. Loaded on demand (never in prod). */
export function DevFolderTools({ folder, planCount, canDeselect, onSelectBy, onDeselect, onSaveWindow, onRandomize }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="pa-select-status" className="sr-only">
        {pa.dev.selectByStatus}
      </label>
      <select
        id="pa-select-status"
        value=""
        onChange={(e) => onSelectBy(e.target.value as SelectKey)}
        className="min-h-9 rounded-md border border-input bg-input px-3 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-ring"
      >
        <option value="" disabled>
          {pa.dev.selectByStatus}
        </option>
        {SELECT_KEYS.map((k) => (
          <option key={k} value={k}>
            {pa.dev.select[k]}
          </option>
        ))}
      </select>
      <button type="button" className={BTN_SECONDARY} onClick={onDeselect} disabled={!canDeselect}>
        {pa.dev.deselect}
      </button>
      <FolderSchedulePopover
        folderName={folder.name}
        min={folder.minScheduledAt}
        max={folder.maxScheduledAt}
        planCount={planCount}
        onSaveWindow={onSaveWindow}
        onRandomize={onRandomize}
      />
    </div>
  )
}
