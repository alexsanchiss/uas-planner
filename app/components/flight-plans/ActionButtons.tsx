import React, { useState } from 'react'
import { IconButtonTooltip } from '../ui/tooltip'

/**
 * TASK-089: TooltipWrapper for disabled button states
 * Shows tooltip on hover when button is disabled
 */
interface TooltipWrapperProps {
  tooltip?: string
  disabled?: boolean
  children: React.ReactNode
}

function TooltipWrapper({ tooltip, disabled, children }: TooltipWrapperProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!tooltip || !disabled) {
    return <>{children}</>
  }

  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded shadow-lg whitespace-nowrap z-50 fade-in">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}

interface ActionButtonProps {
  onClick?: () => void
  disabled?: boolean
  disabledTooltip?: string
  loading?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * TASK-191: Button styles using CSS custom properties from themes.css
 * All buttons now use the unified color scheme for consistent theming
 */
const baseButtonStyles = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed btn-interactive disabled-transition'

// Process Button - Primary/Blue theme (uses --btn-primary-*)
export function ProcessButton({ 
  onClick, 
  disabled, 
  disabledTooltip = 'Select date/time first',
  loading,
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} btn-primary ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Procesando...
          </>
        ) : (
          <>
            <ProcessIcon />
            Procesar
          </>
        )}
      </button>
    </TooltipWrapper>
  )
}

// Download Button - Success/Green theme (uses --btn-success-*)
export function DownloadButton({ 
  onClick, 
  disabled, 
  disabledTooltip = 'No trajectory available',
  loading,
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} btn-success ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Descargando...
          </>
        ) : (
          <>
            <DownloadIcon />
            Descargar
          </>
        )}
      </button>
    </TooltipWrapper>
  )
}

// Authorize Button - Warning/Amber theme (uses --btn-warning-*)
export function AuthorizeButton({ 
  onClick, 
  disabled, 
  disabledTooltip = 'Process trajectory first',
  loading,
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} btn-warning ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Autorizando...
          </>
        ) : (
          <>
            <AuthorizeIcon />
            Autorizar
          </>
        )}
      </button>
    </TooltipWrapper>
  )
}

// Reset Button - Secondary/Gray theme (uses --btn-secondary-*)
export function ResetButton({ 
  onClick, 
  disabled, 
  disabledTooltip = 'Nothing to reset',
  loading,
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} btn-secondary ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Reiniciando...
          </>
        ) : (
          <>
            <ResetIcon />
            Reiniciar
          </>
        )}
      </button>
    </TooltipWrapper>
  )
}

// Delete Button - Danger/Red theme (uses --btn-danger-*)
export function DeleteButton({ 
  onClick, 
  disabled, 
  disabledTooltip,
  loading,
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} btn-danger ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            Eliminando...
          </>
        ) : (
          <>
            <DeleteIcon />
            Eliminar
          </>
        )}
      </button>
    </TooltipWrapper>
  )
}

// Icon Button variants (smaller, icon-only)
interface IconButtonProps {
  onClick?: () => void
  disabled?: boolean
  disabledTooltip?: string
  loading?: boolean
  className?: string
  'aria-label': string
}

/**
 * TASK-191: Icon button styles using theme CSS variables
 * TASK-202: Icon buttons now always show tooltips on hover
 * Uses semantic color tokens for consistent theming
 */
const iconButtonStyles = 'inline-flex items-center justify-center p-2 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed btn-icon-interactive disabled-transition'

export function ProcessIconButton({ onClick, disabled, disabledTooltip, loading, className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202: Show appropriate tooltip based on state
  const tooltipContent = disabled ? (disabledTooltip || 'Procesando no disponible') : 'Procesar trayectoria'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--color-primary)' }}
        className={`${iconButtonStyles} hover:bg-[var(--color-primary-light)] focus:ring-[var(--color-primary)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner /> : <ProcessIcon />}
      </button>
    </IconButtonTooltip>
  )
}

export function DownloadIconButton({ onClick, disabled, disabledTooltip, loading, className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202: Show appropriate tooltip based on state
  const tooltipContent = disabled ? (disabledTooltip || 'Descarga no disponible') : 'Descargar CSV'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--status-success)' }}
        className={`${iconButtonStyles} hover:bg-[var(--status-success-bg)] focus:ring-[var(--status-success)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner /> : <DownloadIcon />}
      </button>
    </IconButtonTooltip>
  )
}

export function AuthorizeIconButton({ onClick, disabled, disabledTooltip, loading, className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202: Show appropriate tooltip based on state
  const tooltipContent = disabled ? (disabledTooltip || 'Autorización no disponible') : 'Solicitar autorización'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--status-warning)' }}
        className={`${iconButtonStyles} hover:bg-[var(--status-warning-bg)] focus:ring-[var(--status-warning)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner /> : <AuthorizeIcon />}
      </button>
    </IconButtonTooltip>
  )
}

export function ResetIconButton({ onClick, disabled, disabledTooltip, loading, className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202: Show appropriate tooltip based on state
  const tooltipContent = disabled ? (disabledTooltip || 'Reinicio no disponible') : 'Reiniciar plan'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--color-secondary)' }}
        className={`${iconButtonStyles} hover:bg-[var(--color-secondary-light)] focus:ring-[var(--color-secondary)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner /> : <ResetIcon />}
      </button>
    </IconButtonTooltip>
  )
}

export function DeleteIconButton({ onClick, disabled, disabledTooltip, loading, className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202: Show appropriate tooltip based on state
  const tooltipContent = disabled ? (disabledTooltip || 'Eliminación no disponible') : 'Eliminar plan'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--status-error)' }}
        className={`${iconButtonStyles} hover:bg-[var(--status-error-bg)] focus:ring-[var(--status-error)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner /> : <DeleteIcon />}
      </button>
    </IconButtonTooltip>
  )
}

// Icons
function ProcessIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function AuthorizeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
