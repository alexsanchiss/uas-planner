/**
 * POST /api/flightPlans/regenerate-volumes
 * 
 * Auto-regenerates missing operation volumes for processed flight plans.
 * Checks all user's plans that:
 * - Have csvResult (are processed)
 * - Don't have operationVolumes in their uplan
 * - Regenerates them automatically without sending to FAS
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, isAuthError } from '@/lib/auth-middleware'
import prisma from '@/lib/prisma'
import { trayToUplan } from '@/lib/uplan/tray_to_uplan'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Authenticate the request
  const auth = await withAuth(request)
  if (isAuthError(auth)) {
    return auth
  }

  const { userId } = auth

  try {
    // Find all processed plans for this user that have csvResult
    // csvResult is a boolean flag (0/1) indicating if CSV data exists
    const plans = await prisma.flightPlan.findMany({
      where: {
        userId,
        status: 'procesado', // Only check processed plans
        csvResult: 1, // Has CSV result data (boolean flag)
      },
    })

    const plansNeedingRegeneration = plans.filter(plan => {
      // Check if uplan exists and has operationVolumes
      let uplanObj: any = plan.uplan
      
      if (typeof uplanObj === 'string') {
        try {
          uplanObj = JSON.parse(uplanObj)
        } catch {
          return true // Invalid JSON, needs regeneration
        }
      }

      // Plan needs regeneration if:
      // 1. No uplan at all
      // 2. uplan has no operationVolumes
      // 3. operationVolumes is empty array
       return !uplanObj || 
             !uplanObj.operationVolumes || 
             !Array.isArray(uplanObj.operationVolumes) ||
             uplanObj.operationVolumes.length === 0
    })

    // console.log(
    //   `[RegenerateVolumes] User ${userId}: ` +
    //   `Checked ${plans.length} processed plans, ` +
    //   `found ${plansNeedingRegeneration.length} needing regeneration`
    // )
    const errors: string[] = []
    let regeneratedCount = 0

    // Regenerate volumes for each plan that needs it
    for (const plan of plansNeedingRegeneration) {
      try {
        // Skip if missing required data
        if (!plan.scheduledAt) {
          console.warn(`[RegenerateVolumes] Plan ${plan.id}: Missing scheduledAt, skipping`)
          errors.push(`Plan ${plan.id} (${plan.customName}): Missing scheduledAt`)
          continue
        }

        if (!plan.csvResult) {
          console.warn(`[RegenerateVolumes] Plan ${plan.id}: Missing csvResult flag, skipping`)
          errors.push(`Plan ${plan.id} (${plan.customName}): No CSV result available`)
          continue
        }

        // Fetch the CSV data (1:1 relationship via same ID)
        // Note: plan.csvResult is just a boolean flag, not an ID
        // The csvResult table uses the same ID as flightPlan
        const csvResultRecord = await prisma.csvResult.findUnique({
          where: { id: plan.id },
        })

        if (!csvResultRecord?.csvResult) {
          console.warn(`[RegenerateVolumes] Plan ${plan.id}: CSV data not found, skipping`)
          errors.push(`Plan ${plan.id} (${plan.customName}): CSV data not found`)
          continue
        }

        // Generate the U-Plan with volumes
        const scheduledAtPosix = Math.floor(
          new Date(plan.scheduledAt).getTime() / 1000
        )

        // Parse existing uplan details if available
        let uplanDetails: unknown
        if (typeof plan.uplan === 'string') {
          try {
            uplanDetails = JSON.parse(plan.uplan)
          } catch {
            uplanDetails = undefined
          }
        } else if (plan.uplan && typeof plan.uplan === 'object') {
          uplanDetails = plan.uplan
        }

        // Extract ground elevation from the .plan file's plannedHomePosition
        let groundElevation = 0;
        if (plan.fileContent) {
          try {
            const planJson = JSON.parse(plan.fileContent);
            const homeAlt = planJson?.mission?.plannedHomePosition?.[2];
            if (typeof homeAlt === 'number' && isFinite(homeAlt)) {
              groundElevation = homeAlt;
            }
          } catch { /* ignore parse errors */ }
        }

        // Generate new U-Plan with volumes
        const newUplan = trayToUplan({
          scheduledAt: scheduledAtPosix,
          csv: csvResultRecord.csvResult,
          groundElevation,
          ...(uplanDetails ? { uplan: uplanDetails } : {}),
        })

        // Convert to JSON string for database storage
        const uplanString = JSON.stringify(newUplan)

        // Update the plan with new U-Plan (DO NOT change authorizationStatus)
        await prisma.flightPlan.update({
          where: { id: plan.id },
          data: {
            uplan: uplanString,
          },
        })

        regeneratedCount++
        console.log(
          `[RegenerateVolumes] ✅ Plan ${plan.id} (${plan.customName}): ` +
          `Regenerated ${newUplan.operationVolumes?.length || 0} volumes`
        )
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[RegenerateVolumes] ❌ Plan ${plan.id}: ${errorMsg}`)
        errors.push(`Plan ${plan.id} (${plan.customName}): ${errorMsg}`)
      }
    }

    return NextResponse.json({
      success: true,
      plansChecked: plans.length,
      plansRegenerated: regeneratedCount,
      errors,
    })
  } catch (error) {
    console.error('[RegenerateVolumes] Failed:', error)
    return NextResponse.json(
      { 
        error: 'Failed to regenerate volumes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
