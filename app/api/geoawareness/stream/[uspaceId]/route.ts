/**
 * GET /api/geoawareness/stream/[uspaceId]
 *
 * Server-Sent Events (SSE) proxy for the geoawareness WebSocket service.
 *
 * Architecture:
 *   Browser  ---(SSE / HTTPS)-->  Next.js backend  ---(ws:// internal)-->  Geoawareness service
 *
 * This avoids mixed-content errors that occur when the browser tries to open a
 * plain ws:// WebSocket from an HTTPS page.  The backend connects to the
 * geoawareness service over the internal network (plain ws:// is fine there)
 * and streams the messages to the client using SSE, which works over HTTPS
 * without any TLS requirement on the geoawareness side.
 *
 * SSE event types emitted:
 *   - (default)  : geoawareness data message (JSON payload forwarded as-is)
 *   - connected  : WebSocket to geoawareness service opened successfully
 *   - error      : WebSocket connection error
 *   - close      : WebSocket connection closed
 *
 * Environment variables (server-side only):
 *   GEOAWARENESS_SERVICE_IP  – host:port of the geoawareness service
 *   GEOAWARENESS_ENDPOINT    – WS path prefix (default: "ws/gas/")
 */

import { NextRequest } from 'next/server'
import WebSocket from 'ws'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── helpers ────────────────────────────────────────────────────────────────

function encodeSSE(event: string, data: unknown): Uint8Array {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  const text = `event: ${event}\ndata: ${payload}\n\n`
  return new TextEncoder().encode(text)
}

function encodeSSEData(data: unknown): Uint8Array {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  const text = `data: ${payload}\n\n`
  return new TextEncoder().encode(text)
}

// ─── route handler ──────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uspaceId: string }> }
) {
  const { uspaceId } = await params

  // ── 1. Validate configuration ──────────────────────────────────────────
  const serviceIp = process.env.GEOAWARENESS_SERVICE_IP
  if (!serviceIp) {
    console.warn('[GeoawarenessSSE] GEOAWARENESS_SERVICE_IP not configured')
    const body = encodeSSE('error', { error: 'Geoawareness service not configured (GEOAWARENESS_SERVICE_IP missing)' })
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }

  const endpointPrefix = process.env.GEOAWARENESS_ENDPOINT ?? 'ws/gas/'
  const wsUrl = `ws://${serviceIp}/${endpointPrefix}${uspaceId}`

  // ── 2. Build a ReadableStream that proxies the WS to SSE ──────────────
  let ws: WebSocket | null = null

  const stream = new ReadableStream({
    start(controller) {
      ws = new WebSocket(wsUrl)

      ws.on('open', () => {
        try {
          controller.enqueue(encodeSSE('connected', { status: 'connected', uspaceId }))
        } catch {
          // controller already closed (client disconnected)
        }
      })

      ws.on('message', (raw) => {
        try {
          controller.enqueue(encodeSSEData(raw.toString()))
        } catch {
          // controller already closed
        }
      })

      ws.on('error', (err) => {
        console.error(`[GeoawarenessSSE] WS error for ${uspaceId}:`, err.message)
        try {
          controller.enqueue(encodeSSE('error', { error: err.message }))
          controller.close()
        } catch {
          // already closed
        }
      })

      ws.on('close', (code, reason) => {
        try {
          controller.enqueue(
            encodeSSE('close', { status: 'closed', code, reason: reason.toString() })
          )
          controller.close()
        } catch {
          // already closed
        }
      })
    },

    cancel() {
      // Client disconnected — tear down the WS so we don't leak it
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Client disconnected')
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      // Prevent nginx / other reverse-proxies from buffering SSE
      'X-Accel-Buffering': 'no',
    },
  })
}
