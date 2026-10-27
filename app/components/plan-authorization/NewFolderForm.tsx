'use client'

import { useId, useState, type Ref } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { useI18n } from '@/app/i18n'

interface Props {
  /** Names already taken (compared case-insensitively). */
  existing: string[]
  /** Resolves true when the folder was created (the field is cleared). */
  onCreate: (name: string) => Promise<boolean>
  inputRef?: Ref<HTMLInputElement>
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** "New folder" field with its Create button; the error is announced under the input. */
export function NewFolderForm({ existing, onCreate, inputRef }: Props) {
  const { t } = useI18n()
  const pa = t.planAuth.folders
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const id = useId()
  const errId = `${id}-err`

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = name.trim()
    if (!value) return setError(pa.nameEmpty)
    if (existing.some((n) => sameName(n, value))) return setError(pa.nameExists)
    setCreating(true)
    const ok = await onCreate(value)
    setCreating(false)
    if (ok) setName('')
  }

  return (
    <form onSubmit={create} className="mb-3">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-fg-2">
        {pa.newFolder}
      </label>
      <div className="flex gap-1">
        <input
          id={id}
          ref={inputRef}
          value={name}
          placeholder={pa.newFolderPlaceholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => {
            setName(e.target.value)
            setError('')
          }}
          className="min-w-0 flex-1 rounded-md border border-input bg-input px-3 py-2 text-base text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-ring sm:text-sm"
        />
        <button
          type="submit"
          disabled={creating}
          aria-label={pa.create}
          title={pa.create}
          className="inline-flex h-11 w-11 shrink-0 lg:h-10 lg:w-10 items-center justify-center rounded-md bg-brand text-brand-fg hover:bg-brand-hover disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <p id={errId} role="alert" className="mt-1 text-xs text-danger-text">
          {error}
        </p>
      )}
    </form>
  )
}
