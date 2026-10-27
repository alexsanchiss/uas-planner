import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** TASK-003: Whether this field has a validation error (for red highlighting) */
  hasValidationError?: boolean;
  /** Visible label, associated to the input through htmlFor/id (generated when `id` is not given). */
  label?: string;
  /** Error message shown under the input; implies the error state and is linked with aria-describedby. */
  error?: string;
}

export const Input: React.FC<InputProps> = ({ className = '', hasValidationError, label, error, id, 'aria-describedby': describedBy, ...props }) => {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const errorId = error ? `${inputId}-error` : undefined
  const invalid = Boolean(hasValidationError || error)

  const input = (
    <input
      id={inputId}
      aria-invalid={invalid || undefined}
      aria-describedby={[describedBy, errorId].filter(Boolean).join(' ') || undefined}
      className={`w-full px-3 py-2 border rounded-md text-[var(--input-text)] placeholder-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
        invalid
          ? 'bg-[var(--status-error-bg)] border-[var(--status-error)] focus:ring-[var(--status-error)]'
          : 'bg-[var(--input-bg)] border-[var(--input-border)] focus:ring-[var(--input-ring)]'
      } ${className}`}
      {...props}
    />
  )

  // Bare input when no label/error: markup and layout stay as before for existing callers.
  if (!label && !error) return input

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-fg-2">
          {label}
        </label>
      )}
      {input}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger-text">
          {error}
        </p>
      )}
    </div>
  )
}
