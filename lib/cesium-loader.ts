/* eslint-disable @typescript-eslint/no-explicit-any -- Cesium loaded dynamically, no static types */

import { apiJson } from './api-client'

let pending: Promise<any> | null = null
let tokenPending: Promise<string> | null = null

/**
 * Cesium Ion access token (GET /api/cesium/token), fetched once per page session through apiJson (one refresh retry on a
 * 401). A failed request is not cached.
 */
export function getCesiumToken(): Promise<string> {
  const p = (tokenPending ??= apiJson<{ token: string }>('/api/cesium/token').then((r) => r.token))
  p.catch(() => {
    if (tokenPending === p) tokenPending = null
  })
  return p
}

/**
 * Load Cesium from the pre-built UMD bundle in /public/cesium (client only).
 * The script is injected once; concurrent callers share the same promise.
 * If `token` is given it is set as the Cesium Ion access token.
 */
export function loadCesium(token?: string): Promise<any> {
  const w = window as any
  const loaded: Promise<any> = w.Cesium
    ? Promise.resolve(w.Cesium)
    : (pending ??= new Promise((resolve, reject) => {
        if (!document.querySelector('link[href="/cesium/Widgets/widgets.css"]')) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = '/cesium/Widgets/widgets.css'
          document.head.appendChild(link)
        }

        const script = document.createElement('script')
        script.src = '/cesium/Cesium.js'
        script.onload = () => {
          if (w.Cesium) resolve(w.Cesium)
          else reject(new Error('Cesium failed to load'))
        }
        script.onerror = () => reject(new Error('Failed to load Cesium script'))
        document.head.appendChild(script)
      }))
  // A failed load must not be cached, or every later modal open would fail too.
  loaded.catch(() => { pending = null })

  return loaded.then((Cesium) => {
    if (token) Cesium.Ion.defaultAccessToken = token
    ;(window as any).CESIUM_BASE_URL = '/cesium'
    return Cesium
  })
}
