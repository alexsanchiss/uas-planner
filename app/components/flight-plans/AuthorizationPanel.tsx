'use client'

import React from 'react'
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
        {authorizationMessage && (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            {authorizationMessage}
          </p>
        )}
      </div>

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
