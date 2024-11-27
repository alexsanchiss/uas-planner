import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline'
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  className = '', 
  variant = 'default', 
  ...props 
}) => {
  const baseStyles = 'px-4 py-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-opacity-50'
  const variantStyles = variant === 'default' 
    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
    : 'bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-700 focus:ring-gray-500'

  return (
    <button className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      {children}
    </button>
  )
}

