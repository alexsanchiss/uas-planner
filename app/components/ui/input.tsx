import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** TASK-003: Whether this field has a validation error (for red highlighting) */
  hasValidationError?: boolean;
}

export const Input: React.FC<InputProps> = ({ className = '', hasValidationError, ...props }) => {
  return (
    <input
      className={`w-full px-3 py-2 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
        hasValidationError
          ? 'bg-red-900/20 border-red-500 focus:ring-red-500'
          : 'bg-gray-700 border-gray-600 focus:ring-blue-500'
      } ${className}`}
      {...props}
    />
  )
}

