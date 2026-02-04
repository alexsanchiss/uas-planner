'use client'

import React, { useState } from 'react'
import { AuthorizationStatusBadge, type AuthorizationStatus } from './StatusBadge'

export interface AuthorizationPanelProps {
  planId: string
  authorizationStatus: AuthorizationStatus
  authorizationMessage?: string | null
  isProcessed: boolean
  onCheckGeoawareness: () => void
  onAuthorize: () => void
  isCheckingGeoawareness?: boolean
  isAuthorizing?: boolean
  geoawarenessResult?: 'pass' | 'fail' | null
  className?: string
}

/**
 * Attempt to parse and format a JSON string
 * Returns formatted JSON if valid, or the original string if not
 */
function formatJsonMessage(message: string): { formatted: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(message)
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true }
  } catch {
    return { formatted: message, isJson: false }
  }
}

/**
 * FASResponseViewer - Component to display and copy FAS response messages
 */
function FASResponseViewer({ 
  message, 
  className = '' 
}: { 
  message: string
  className?: string 
}) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  
  const { formatted, isJson } = formatJsonMessage(message)
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isJson ? formatted : message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = isJson ? formatted : message
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const lineCount = formatted.split('\n').length
  const shouldCollapse = lineCount > 10

  return (
    <div className={`bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* Header with copy button */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            FAS Response
          </span>
          {isJson && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
              JSON
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {shouldCollapse && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              copied 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            aria-label="Copy to clipboard"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Content area with syntax highlighting for JSON */}
      <div 
        className={`overflow-auto ${shouldCollapse && !isExpanded ? 'max-h-48' : 'max-h-96'}`}
      >
        {isJson ? (
          <pre className="p-3 text-xs font-mono whitespace-pre overflow-x-auto">
            <code className="text-gray-800 dark:text-gray-200">
              {formatted.split('\n').map((line, index) => {
                // Simple syntax highlighting for JSON
                const highlightedLine = line
                  .replace(/"([^"]+)":/g, '<span class="text-purple-600 dark:text-purple-400">"$1"</span>:')
                  .replace(/: "(.*?)"/g, ': <span class="text-green-600 dark:text-green-400">"$1"</span>')
                  .replace(/: (\d+\.?\d*)/g, ': <span class="text-blue-600 dark:text-blue-400">$1</span>')
                  .replace(/: (true|false)/g, ': <span class="text-orange-600 dark:text-orange-400">$1</span>')
                  .replace(/: (null)/g, ': <span class="text-red-600 dark:text-red-400">$1</span>')
                
                return (
                  <div key={index} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: highlightedLine }} />
                )
              })}
            </code>
          </pre>
        ) : (
          <p className="p-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
            {formatted}
          </p>
        )}
      </div>

      {/* Gradient fade for collapsed state */}
      {shouldCollapse && !isExpanded && (
        <div className="h-8 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent -mt-8 relative pointer-events-none" />
      )}
    </div>
  )
}

export function AuthorizationPanel({
  planId,
  authorizationStatus,
  authorizationMessage,
  isProcessed,
  onCheckGeoawareness,
  onAuthorize,
  isCheckingGeoawareness = false,
  isAuthorizing = false,
  geoawarenessResult = null,
  className = '',
}: AuthorizationPanelProps) {
  const canCheckGeoawareness = isProcessed && !isCheckingGeoawareness
  const canAuthorize =
    isProcessed &&
    geoawarenessResult === 'pass' &&
    authorizationStatus !== 'aprobado' &&
    !isAuthorizing

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Authorization Workflow
      </h3>

      {/* Current Status */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Current Status:</span>
          <AuthorizationStatusBadge status={authorizationStatus} />
        </div>
      </div>

      {/* FAS Response Viewer - shows formatted authorizationMessage */}
      {authorizationMessage && (
        <div className="mb-4">
          <FASResponseViewer message={authorizationMessage} />
        </div>
      )}

      {/* Pre-requisite warning */}
      {!isProcessed && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ Flight plan must be processed before authorization.
          </p>
        </div>
      )}

      {/* Step 1: Geoawareness Check */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            1. Geoawareness Check
          </span>
          {geoawarenessResult && (
            <span
              className={`text-xs px-2 py-1 rounded ${
                geoawarenessResult === 'pass'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {geoawarenessResult === 'pass' ? '✓ Passed' : '✗ Failed'}
            </span>
          )}
        </div>
        <button
          onClick={onCheckGeoawareness}
          disabled={!canCheckGeoawareness}
          className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            canCheckGeoawareness
              ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          {isCheckingGeoawareness ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Checking...
            </span>
          ) : (
            'Check Geoawareness'
          )}
        </button>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Verify trajectory against airspace restrictions
        </p>
      </div>

      {/* Step 2: FAS Authorization */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            2. FAS Authorization
          </span>
        </div>
        <button
          onClick={onAuthorize}
          disabled={!canAuthorize}
          className={`w-full px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            canAuthorize
              ? 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          {isAuthorizing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Authorizing...
            </span>
          ) : (
            'Request Authorization'
          )}
        </button>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {geoawarenessResult !== 'pass'
            ? 'Requires successful geoawareness check'
            : 'Submit flight plan to FAS for approval'}
        </p>
      </div>
    </div>
  )
}

export default AuthorizationPanel
