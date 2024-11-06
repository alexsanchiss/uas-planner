/*
  Warnings:

  - You are about to drop the column `machineAssignedId` on the `FlightPlan` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FlightPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileContent" TEXT NOT NULL,
    "csvResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "machineAssignedName" TEXT
);
INSERT INTO "new_FlightPlan" ("createdAt", "csvResult", "customName", "fileContent", "id", "status") SELECT "createdAt", "csvResult", "customName", "fileContent", "id", "status" FROM "FlightPlan";
DROP TABLE "FlightPlan";
ALTER TABLE "new_FlightPlan" RENAME TO "FlightPlan";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
