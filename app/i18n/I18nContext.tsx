'use client'

/**
 * i18n Context and Provider
 * 
 * React context for managing language state across the application.
 * Default language: English
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { Language, Translations, getTranslation, defaultLanguage } from './translations'

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: Translations
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const LANGUAGE_STORAGE_KEY = 'uas-planner-language'

interface I18nProviderProps {
  children: ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage)
  const [mounted, setMounted] = useState(false)

  // Load language from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === 'en' || stored === 'es') {
      setLanguageState(stored)
    }
    setMounted(true)
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  }, [])

  const t = getTranslation(language)

  // Prevent hydration mismatch by rendering children only after mount
  if (!mounted) {
    return (
      <I18nContext.Provider value={{ language: defaultLanguage, setLanguage, t: getTranslation(defaultLanguage) }}>
        {children}
      </I18nContext.Provider>
    )
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

/**
 * Helper function to interpolate variables in translation strings
 * Usage: interpolate(t.time.minutesAgo, { n: 5 }) -> "5 minutes ago"
 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/{(\w+)}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}
