import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** TASK-003: Whether this field has a validation error (for red highlighting) */
  hasValidationError?: boolean;
}

export const Input: React.FC<InputProps> = ({ className = '', hasValidationError, ...props }) => {
  return (
    <input
      className={`w-full px-3 py-2 border rounded-md text-[var(--input-text)] placeholder-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
        hasValidationError
          ? 'bg-[var(--status-error-bg)] border-[var(--status-error)] focus:ring-[var(--status-error)]'
          : 'bg-[var(--input-bg)] border-[var(--input-border)] focus:ring-[var(--input-ring)]'
      } ${className}`}
      {...props}
    />
  )
}

