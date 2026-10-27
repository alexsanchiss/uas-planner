'use client'

import { Fragment, type ReactNode } from 'react'
import { Menu } from '@base-ui/react/menu'
import { ChevronDown, ChevronRight, Loader2, MoreHorizontal, type LucideIcon } from 'lucide-react'

export interface MenuEntry {
  id: string
  label: string
  icon?: LucideIcon
  onSelect?: () => void
  disabled?: boolean
  /** Why the entry is disabled (shown as its title). */
  reason?: string
  tone?: 'danger'
  separatorBefore?: boolean
  loading?: boolean
  /** Entries of a submenu (onSelect is ignored). */
  children?: MenuEntry[]
}

const ITEM =
  'flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-hover data-[popup-open]:bg-hover'
const POPUP =
  'max-h-[60dvh] min-w-52 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-line bg-surface-elevated p-1 shadow-theme-md outline-none'

function Content({ entry }: { entry: MenuEntry }) {
  const Icon = entry.icon
  return (
    <>
      {entry.loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <span className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
    </>
  )
}

function Entries({ entries }: { entries: MenuEntry[] }) {
  return (
    <>
      {entries.map((e) => {
        const tone = e.tone === 'danger' ? 'text-danger-text' : 'text-fg-2 data-[highlighted]:text-fg'
        return (
          <Fragment key={e.id}>
            {e.separatorBefore && <Menu.Separator className="my-1 h-px bg-line" />}
            {e.children ? (
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger label={e.label} className={`${ITEM} ${tone}`} disabled={e.disabled} title={e.disabled ? e.reason : undefined}>
                  <Content entry={e} />
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner className="z-40" sideOffset={4}>
                    <Menu.Popup className={POPUP}>
                      <Entries entries={e.children} />
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            ) : (
              <Menu.Item
                label={e.label}
                className={`${ITEM} ${tone}`}
                disabled={e.disabled || e.loading}
                onClick={e.onSelect}
                title={e.disabled ? e.reason : undefined}
              >
                <Content entry={e} />
              </Menu.Item>
            )}
          </Fragment>
        )
      })}
    </>
  )
}

interface Props {
  /** Accessible name of the trigger (always set: icon-only triggers have no other label). */
  label: string
  entries: MenuEntry[]
  /** Text trigger content (with a chevron). Omit for the icon-only "more" trigger. */
  children?: ReactNode
  align?: 'start' | 'center' | 'end'
  disabled?: boolean
  className?: string
}

/** Keyboard-operable action menu on Base UI Menu (arrow keys, type-ahead, Escape, focus return). */
export function ActionMenu({ label, entries, children, align = 'end', disabled, className = '' }: Props) {
  const base = children
    ? 'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line-2 bg-surface px-3 text-sm font-medium text-fg hover:bg-hover'
    : 'inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-2 hover:bg-hover hover:text-fg'
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={children ? undefined : label}
        disabled={disabled}
        className={`${base} data-[popup-open]:bg-hover disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        {children ? (
          <>
            {children}
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </>
        ) : (
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-40" sideOffset={4} align={align}>
          <Menu.Popup className={POPUP} aria-label={label}>
            <Entries entries={entries} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
