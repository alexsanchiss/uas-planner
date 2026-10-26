/**
 * Browser file helpers: zip download (JSZip + file-saver, loaded on demand), text download,
 * zip/plan expansion for uploads and trajectory CSV parsing. The heavy libraries are imported
 * inside the functions so they stay out of the page's first chunk.
 */

export const ZIP_MAX_FILES = 1000
/** Plans per POST /api/flightPlans when uploading (payload size guard, same as the old Dev). */
export const UPLOAD_BATCH = 50

// ---- Download -------------------------------------------------------------------------

export function saveText(content: string, mime: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** "name.ext", then "name (1).ext", ... unique inside one download. */
function uniqueName(base: string, ext: string, used: Set<string>): string {
  let name = `${base}.${ext}`
  for (let n = 1; used.has(name); n++) name = `${base} (${n}).${ext}`
  used.add(name)
  return name
}

/**
 * Zip `entries` (one file each, extension `ext`) and save: one zip, or several of at most
 * ZIP_MAX_FILES files named `<zipBase>_<from>-<to>.zip`.
 */
export async function saveZips(entries: { name: string; content: string }[], ext: string, zipBase: string): Promise<void> {
  const [{ default: JSZip }, { saveAs }] = await Promise.all([import('jszip'), import('file-saver')])
  const used = new Set<string>()
  for (let j = 0; j < entries.length; j += ZIP_MAX_FILES) {
    const chunk = entries.slice(j, j + ZIP_MAX_FILES)
    const zip = new JSZip()
    for (const e of chunk) zip.file(uniqueName(e.name, ext, used), e.content)
    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, entries.length > ZIP_MAX_FILES ? `${zipBase}_${j + 1}-${j + chunk.length}.zip` : `${zipBase}.zip`)
  }
}

/** Run `worker` over `items`, at most `limit` at a time. */
export async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const lane = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await worker(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  return out
}

// ---- Upload ---------------------------------------------------------------------------

export interface VirtualFile {
  name: string
  getText: () => Promise<string>
}

/** Plain files stay as they are; every entry of a .zip becomes a file (non-text entries are not filtered, a broken zip is skipped). */
export async function expandFiles(files: File[]): Promise<VirtualFile[]> {
  const out: VirtualFile[] = []
  for (const f of files) {
    const isZip = f.name.toLowerCase().endsWith('.zip') || f.type === 'application/zip'
    if (!isZip) {
      out.push({ name: f.name, getText: () => f.text() })
      continue
    }
    try {
      const { default: JSZip } = await import('jszip')
      const zip = await JSZip.loadAsync(await f.arrayBuffer())
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue
        out.push({ name: entry.name.split('/').pop() || entry.name, getText: () => entry.async('text') })
      }
    } catch (e) {
      console.error('Failed to parse zip:', f.name, e)
    }
  }
  return out
}

/** Name of the plan created from a file: the file name without its extension. */
export const planNameFromFile = (fileName: string) => fileName.replace(/\.[^/.]+$/, '')

// ---- Trajectory CSV -------------------------------------------------------------------

export interface TrajectoryRow {
  SimTime: string
  Lat: number
  Lon: number
  Alt: number
  qw: string
  qx: string
  qy: string
  qz: string
  Vx: string
  Vy: string
  Vz: string
}

type RawCsvRow = Record<string, string>

export async function parseTrajectoryCsv(csv: string): Promise<TrajectoryRow[]> {
  const { default: Papa } = await import('papaparse')
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true }) as { data: RawCsvRow[] }
  return parsed.data
    .map((row) => ({
      SimTime: row.SimTime,
      Lat: parseFloat(row.Lat),
      Lon: parseFloat(row.Lon),
      Alt: parseFloat(row.Alt),
      qw: row.qw,
      qx: row.qx,
      qy: row.qy,
      qz: row.qz,
      Vx: row.Vx,
      Vy: row.Vy,
      Vz: row.Vz,
    }))
    .filter((row) => !isNaN(row.Lat) && !isNaN(row.Lon))
}
