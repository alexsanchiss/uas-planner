/**
 * Dev: plan files and zips dropped on a folder become new plans. Imported on demand by useGroupActions
 * (only when a non-.json file is dropped in Dev), so none of it is in the production bundle.
 */

import { interpolate, type Translations } from '@/app/i18n'
import type { UseFlightPlansReturn } from '@/app/hooks/useFlightPlans'
import type { useToast } from '@/app/hooks/useToast'
import type { PlanRow } from './lib'

/** Plans per POST /api/flightPlans when uploading (payload size guard, same as the old Dev). */
export const UPLOAD_BATCH = 50

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

interface Deps {
  fp: UseFlightPlansReturn<PlanRow>
  toast: ReturnType<typeof useToast>
  pa: Translations['planAuth']
}

/** Chunks of UPLOAD_BATCH plans per POST. */
export async function uploadPlans({ fp, toast, pa }: Deps, files: File[], folderId: number): Promise<void> {
  const virtual = await expandFiles(files)
  if (virtual.length === 0) return void toast.warning(pa.toast.nothingToUpload)
  toast.info(interpolate(pa.toast.uploading, { n: virtual.length }))
  let created = 0
  for (let i = 0; i < virtual.length; i += UPLOAD_BATCH) {
    const payload = await Promise.all(
      virtual.slice(i, i + UPLOAD_BATCH).map(async (vf) => ({
        customName: planNameFromFile(vf.name),
        status: 'sin procesar' as const,
        fileContent: await vf.getText(),
        folderId,
      }))
    )
    const res = await fp.createFlightPlans(payload)
    if (!res) {
      toast.error(pa.toast.uploadError)
      break
    }
    created += res.createdCount
  }
  if (created > 0) toast.success(interpolate(pa.toast.uploaded, { n: created }))
}
