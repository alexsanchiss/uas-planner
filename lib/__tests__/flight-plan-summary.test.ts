/**
 * lib/flight-plan-summary.ts: the ONE select behind every "summary" row (the list, the paged list, and
 * GET /api/flightPlans/[id]?fields=summary). If a heavy column slips in, every poll downloads it again; if `userId`
 * slips out, the [id] route can no longer tell whose plan it is.
 */

import { SUMMARY_SELECT } from '../flight-plan-summary'

describe('SUMMARY_SELECT', () => {
  it('never selects a heavy column (fileContent, uplan, activationMessage)', () => {
    for (const col of ['fileContent', 'uplan', 'activationMessage']) expect(SUMMARY_SELECT).not.toHaveProperty(col)
  })

  it('keeps what the ownership check and the lists read: userId, folderId, folder, authorizationMessage, geoawarenessData, statuses', () => {
    for (const col of ['id', 'userId', 'folderId', 'folder', 'authorizationMessage', 'geoawarenessData', 'status', 'authorizationStatus', 'csvResult', 'scheduledAt', 'externalResponseNumber', 'activationStatus'])
      expect({ col, v: (SUMMARY_SELECT as Record<string, unknown>)[col] }).toEqual({ col, v: true })
  })

  it('is a plain select of true flags (no nested include that could pull a relation\'s heavy columns by accident)', () => {
    expect(Object.values(SUMMARY_SELECT).every((v) => v === true)).toBe(true)
  })

  it('pins the column list: a new column is a conscious decision', () => {
    expect(Object.keys(SUMMARY_SELECT).sort()).toEqual(
      ['activatedAt', 'activationStatus', 'authorizationMessage', 'authorizationStatus', 'createdAt', 'csvResult', 'customName', 'externalResponseNumber', 'folder', 'folderId', 'geoawarenessData', 'id', 'lastActivationAttempt', 'machineAssignedId', 'scheduledAt', 'status', 'termsAcceptedAt', 'userId'].sort()
    )
  })
})
