'use client'

import { useId, useRef, useState, type DragEvent } from 'react'
import { FileJson, Upload } from 'lucide-react'
import { interpolate, useI18n } from '@/app/i18n'
import { PLAN_DRAG_TYPE } from './lib'

interface Props {
  folderName: string
  disabled?: boolean
  /** Files dropped or chosen (plans, .zip, U-plan .json): the container decides what each one is. */
  onFiles: (files: File[]) => void
}

const btn =
  'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line-2 bg-surface px-3 text-sm font-medium text-fg hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50'

/** Dev: drag & drop + file pickers for the selected folder (plan files, zips and external U-plan .json). */
export function UploadDropzone({ folderName, disabled, onFiles }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth.upload
  const [over, setOver] = useState(false)
  const plansInput = useRef<HTMLInputElement>(null)
  const uplanInput = useRef<HTMLInputElement>(null)
  const hintId = useId()

  const isFileDrag = (e: DragEvent) => !e.dataTransfer.types.includes(PLAN_DRAG_TYPE) && e.dataTransfer.types.includes('Files')

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // the same file can be chosen again
    if (files.length) onFiles(files)
  }

  return (
    <div
      role="group"
      aria-label={pa.label}
      aria-describedby={hintId}
      onDragOver={(e) => {
        if (disabled || !isFileDrag(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        if (disabled || !isFileDrag(e)) return
        e.preventDefault()
        const files = Array.from(e.dataTransfer.files)
        if (files.length) onFiles(files)
      }}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors ${
        over ? 'border-brand-ring bg-info-soft' : 'border-line-2 bg-surface'
      }`}
    >
      <p id={hintId} className="flex items-center gap-2 text-sm text-fg-2">
        <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
        {disabled ? pa.selectFolder : interpolate(pa.hintDev, { folder: folderName })}
      </p>
      <div className="flex flex-wrap gap-2">
        <input ref={plansInput} type="file" multiple className="sr-only" tabIndex={-1} aria-label={pa.plansInput} onChange={pick} />
        <button type="button" className={btn} disabled={disabled} onClick={() => plansInput.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {pa.uploadPlans}
        </button>
        <input ref={uplanInput} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label={pa.uplanInput} onChange={pick} />
        <button type="button" className={btn} disabled={disabled} onClick={() => uplanInput.current?.click()}>
          <FileJson className="h-4 w-4" aria-hidden="true" />
          {pa.importUplan}
        </button>
      </div>
    </div>
  )
}
