-- CreateTable
CREATE TABLE "FlightPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileContent" TEXT NOT NULL,
    "csvResult" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
