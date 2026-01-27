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

/**
 * TASK-218: Button size variants for touch-friendly buttons
 * sm: compact for dense UIs (min 36px touch target)
 * md: default balanced size (min 40px touch target)
 * lg: large touch-friendly buttons (min 48px touch target)
 */
type ButtonSize = 'sm' | 'md' | 'lg'

interface ActionButtonProps {
  onClick?: () => void
  disabled?: boolean
  disabledTooltip?: string
  loading?: boolean
  className?: string
  /** TASK-218: Button size - sm, md (default), or lg for touch-friendly */
  size?: ButtonSize
  children: React.ReactNode
}

/**
 * TASK-191: Button styles using CSS custom properties from themes.css
 * TASK-218: Updated with larger default sizes for better touch targets
 * All buttons now use the unified color scheme for consistent theming
 */
const baseButtonStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed btn-interactive disabled-transition'

/** TASK-218: Size-specific styles for full buttons */
const buttonSizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-base gap-2',
}

// Process Button - Primary/Blue theme (uses --btn-primary-*)
export function ProcessButton({ 
  onClick, 
  disabled, 
  disabledTooltip = 'Select date/time first',
  loading,
  size = 'md',
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} ${buttonSizeStyles[size]} btn-primary ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner size={size} />
            Processing...
          </>
        ) : (
          <>
            <ProcessIcon size={size} />
            Process
          </>
        )}
      </button>
    </TooltipWrapper>
  )
}

// Download/View Button - Success/Green theme (uses --btn-success-*)
// TASK-219: Now opens trajectory map viewer instead of downloading
export function DownloadButton({ 
  onClick, 
  disabled, 
  disabledTooltip = 'No trajectory available',
  loading,
  size = 'md',
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} ${buttonSizeStyles[size]} btn-success ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner size={size} />
            Loading...
          </>
        ) : (
          <>
            <MapViewIcon size={size} />
            View trajectory
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
  size = 'md',
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} ${buttonSizeStyles[size]} btn-warning ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner size={size} />
            Authorizing...
          </>
        ) : (
          <>
            <AuthorizeIcon size={size} />
            Authorize
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
  size = 'md',
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} ${buttonSizeStyles[size]} btn-secondary ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner size={size} />
            Resetting...
          </>
        ) : (
          <>
            <ResetIcon size={size} />
            Reset
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
  size = 'md',
  className = '' 
}: Omit<ActionButtonProps, 'children'>) {
  return (
    <TooltipWrapper tooltip={disabledTooltip} disabled={disabled}>
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${baseButtonStyles} ${buttonSizeStyles[size]} btn-danger ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner size={size} />
            Deleting...
          </>
        ) : (
          <>
            <DeleteIcon size={size} />
            Delete
          </>
        )}
      </button>
    </TooltipWrapper>
  )
}

// Icon Button variants (touch-friendly icon-only buttons)
interface IconButtonProps {
  onClick?: () => void
  disabled?: boolean
  disabledTooltip?: string
  loading?: boolean
  className?: string
  /** TASK-218: Icon button size - sm, md (default), or lg for touch-friendly */
  size?: ButtonSize
  'aria-label': string
}

/**
 * TASK-191: Icon button styles using theme CSS variables
 * TASK-202: Icon buttons now always show tooltips on hover
 * TASK-218: Updated with larger sizes for better touch targets (min 44px recommended)
 * Uses semantic color tokens for consistent theming
 */
const iconButtonBaseStyles = 'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed btn-icon-interactive disabled-transition'

/** TASK-218: Size-specific styles for icon buttons - ensures minimum touch target */
const iconButtonSizeStyles: Record<ButtonSize, string> = {
  sm: 'p-2 min-w-[36px] min-h-[36px]',      // 36px touch target
  md: 'p-2.5 min-w-[44px] min-h-[44px]',    // 44px touch target (recommended minimum)
  lg: 'p-3 min-w-[52px] min-h-[52px]',      // 52px touch target (extra large)
}

export function ProcessIconButton({ onClick, disabled, disabledTooltip, loading, size = 'md', className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202: Show appropriate tooltip based on state
  const tooltipContent = disabled ? (disabledTooltip || 'Processing not available') : 'Process trajectory'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--color-primary)' }}
        className={`${iconButtonBaseStyles} ${iconButtonSizeStyles[size]} hover:bg-[var(--color-primary-light)] focus:ring-[var(--color-primary)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner size={size} /> : <ProcessIcon size={size} />}
      </button>
    </IconButtonTooltip>
  )
}

export function DownloadIconButton({ onClick, disabled, disabledTooltip, loading, size = 'md', className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202/219: Show appropriate tooltip based on state - now opens trajectory map viewer
  const tooltipContent = disabled ? (disabledTooltip || 'No trajectory available') : 'View trajectory'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--status-success)' }}
        className={`${iconButtonBaseStyles} ${iconButtonSizeStyles[size]} hover:bg-[var(--status-success-bg)] focus:ring-[var(--status-success)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner size={size} /> : <MapViewIcon size={size} />}
      </button>
    </IconButtonTooltip>
  )
}

export function AuthorizeIconButton({ onClick, disabled, disabledTooltip, loading, size = 'md', className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202: Show appropriate tooltip based on state
  const tooltipContent = disabled ? (disabledTooltip || 'Authorization not available') : 'Request authorization'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--status-warning)' }}
        className={`${iconButtonBaseStyles} ${iconButtonSizeStyles[size]} hover:bg-[var(--status-warning-bg)] focus:ring-[var(--status-warning)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner size={size} /> : <AuthorizeIcon size={size} />}
      </button>
    </IconButtonTooltip>
  )
}

/**
 * Authorization result icon button - shows different colors based on authorization status
 * Green (approved), Red (denied), or Amber (pending/request)
 * Clickable to view the authorization message
 */
export interface AuthorizationResultButtonProps extends IconButtonProps {
  authorizationStatus: 'sin autorización' | 'pendiente' | 'aprobado' | 'denegado'
  onViewMessage?: () => void
}

export function AuthorizationResultIconButton({ 
  onClick, 
  disabled, 
  disabledTooltip, 
  loading, 
  size = 'md', 
  className = '', 
  'aria-label': ariaLabel,
  authorizationStatus,
  onViewMessage,
}: AuthorizationResultButtonProps) {
  // Determine color and tooltip based on authorization status
  const getColorAndTooltip = () => {
    switch (authorizationStatus) {
      case 'aprobado':
        return {
          color: 'var(--status-success)',
          hoverBg: 'var(--status-success-bg)',
          ring: 'var(--status-success)',
          tooltip: 'Authorization approved - click to view',
          icon: <CheckShieldIcon size={size} />,
          isPending: false,
        }
      case 'denegado':
        return {
          color: 'var(--status-error)',
          hoverBg: 'var(--status-error-bg)',
          ring: 'var(--status-error)',
          tooltip: 'Authorization denied - click to view reason',
          icon: <DeniedShieldIcon size={size} />,
          isPending: false,
        }
      case 'pendiente':
        return {
          color: 'var(--status-warning)',
          hoverBg: 'var(--status-warning-bg)',
          ring: 'var(--status-warning)',
          tooltip: 'FAS is processing the request...',
          icon: <FasProcessingIcon size={size} />,
          isPending: true,
        }
      default:
        return {
          color: 'var(--status-warning)',
          hoverBg: 'var(--status-warning-bg)',
          ring: 'var(--status-warning)',
          tooltip: disabled ? (disabledTooltip || 'Authorization not available') : 'Request authorization',
          icon: <AuthorizeIcon size={size} />,
          isPending: false,
        }
    }
  }

  const { color, hoverBg, ring, tooltip, icon, isPending } = getColorAndTooltip()
  
  // If approved or denied, clicking should show the message
  const handleClick = () => {
    if ((authorizationStatus === 'aprobado' || authorizationStatus === 'denegado') && onViewMessage) {
      onViewMessage()
    } else if (onClick) {
      onClick()
    }
  }

  // Only disable if status is pending or no authorization and the original disabled condition
  const isDisabled = authorizationStatus === 'pendiente' || 
                     (authorizationStatus === 'sin autorización' && disabled)
  
  return (
    <IconButtonTooltip content={tooltip} position="top">
      <button
        onClick={handleClick}
        disabled={isDisabled || loading}
        aria-label={ariaLabel}
        style={{ color }}
        className={`${iconButtonBaseStyles} ${iconButtonSizeStyles[size]} hover:bg-[${hoverBg}] focus:ring-[${ring}] disabled:opacity-50 ${isPending ? 'animate-pulse' : ''} ${className}`}
      >
        {loading ? <LoadingSpinner size={size} /> : icon}
      </button>
    </IconButtonTooltip>
  )
}

export function ResetIconButton({ onClick, disabled, disabledTooltip, loading, size = 'md', className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202: Show appropriate tooltip based on state
  const tooltipContent = disabled ? (disabledTooltip || 'Reset not available') : 'Reset plan'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--color-secondary)' }}
        className={`${iconButtonBaseStyles} ${iconButtonSizeStyles[size]} hover:bg-[var(--color-secondary-light)] focus:ring-[var(--color-secondary)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner size={size} /> : <ResetIcon size={size} />}
      </button>
    </IconButtonTooltip>
  )
}

export function DeleteIconButton({ onClick, disabled, disabledTooltip, loading, size = 'md', className = '', 'aria-label': ariaLabel }: IconButtonProps) {
  // TASK-202: Show appropriate tooltip based on state
  const tooltipContent = disabled ? (disabledTooltip || 'Deletion not available') : 'Delete plan'
  
  return (
    <IconButtonTooltip content={tooltipContent} position="top">
      <button
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        style={{ color: 'var(--status-error)' }}
        className={`${iconButtonBaseStyles} ${iconButtonSizeStyles[size]} hover:bg-[var(--status-error-bg)] focus:ring-[var(--status-error)] disabled:opacity-50 ${className}`}
      >
        {loading ? <LoadingSpinner size={size} /> : <DeleteIcon size={size} />}
      </button>
    </IconButtonTooltip>
  )
}

// Icons with size support
/** TASK-218: Icon size classes based on button size */
const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

interface IconProps {
  size?: ButtonSize
}

function ProcessIcon({ size = 'md' }: IconProps) {
  return (
    <svg className={iconSizeClasses[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

/** TASK-219: Map view icon for trajectory viewer button */
function MapViewIcon({ size = 'md' }: IconProps) {
  return (
    <svg className={iconSizeClasses[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function AuthorizeIcon({ size = 'md' }: IconProps) {
  return (
    <svg className={iconSizeClasses[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

/** Approved shield icon with checkmark */
function CheckShieldIcon({ size = 'md' }: IconProps) {
  return (
    <svg className={iconSizeClasses[size]} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016A11.955 11.955 0 0112 2.944zm3.707 7.763a1 1 0 00-1.414-1.414L11 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  )
}

/** Denied shield icon with X */
function DeniedShieldIcon({ size = 'md' }: IconProps) {
  return (
    <svg className={iconSizeClasses[size]} fill="currentColor" viewBox="0 0 24 24">
      <path fillRule="evenodd" d="M12 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016A11.955 11.955 0 0112 2.944zM9.707 9.707a1 1 0 00-1.414 1.414L10.586 12l-2.293 2.879a1 1 0 101.414 1.414L12 14.414l2.293 1.879a1 1 0 001.414-1.414L13.414 12l2.293-2.879a1 1 0 00-1.414-1.414L12 9.586l-2.293-1.879z" clipRule="evenodd" />
    </svg>
  )
}

/** Pending shield icon with clock/dots */
function PendingShieldIcon({ size = 'md' }: IconProps) {
  return (
    <svg className={iconSizeClasses[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

/** TASK-034: FAS processing icon - animated spinner with shield */
function FasProcessingIcon({ size = 'md' }: IconProps) {
  return (
    <div className="relative">
      <svg className={`${iconSizeClasses[size]} animate-spin`} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  )
}

function ResetIcon({ size = 'md' }: IconProps) {
  return (
    <svg className={iconSizeClasses[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

function DeleteIcon({ size = 'md' }: IconProps) {
  return (
    <svg className={iconSizeClasses[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

/** TASK-218: Loading spinner with size variants */
function LoadingSpinner({ size = 'md' }: IconProps) {
  return (
    <svg className={`${iconSizeClasses[size]} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}
