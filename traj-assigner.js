require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
let isProcessing = false;
const logFile = 'log.csv';

// Asegurar que el archivo CSV tiene encabezado
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, 'id,CustomName,Inicio\n');
}

// ---- FUNCIÓN DE LIMPIEZA SOLO DE PROCESADOS CON csvResult < 2KB ----
const cleanSmallCsvResults = async () => {
  try {
    // 1. Seleccionar solo IDs de csvResult con menos de 2KB
    const rows = await prisma.$queryRawUnsafe(`
      SELECT fp.id
      FROM flightPlan fp
      JOIN csvResult cr ON cr.id = fp.id
      WHERE fp.status = "procesado"
        AND fp.csvResult = 1
        AND OCTET_LENGTH(cr.csvResult) < 2048
    `);

    const smallIds = rows.map(r => r.id);
    if (smallIds.length === 0) {
      console.log('📁 No hay planes con csvResult < 2KB.');
      return;
    }

    // 2. Resetear flightPlan asociado
    const resetSmall = await prisma.flightPlan.updateMany({
      where: { id: { in: smallIds } },
      data: { status: 'en cola', machineAssignedId: null, csvResult: null },
    });

    // 3. Eliminar filas de csvResult
    const deleted = await prisma.csvResult.deleteMany({
      where: { id: { in: smallIds } },
    });

    console.log(`📉 Reestablecidos ${resetSmall.count} planes y eliminados ${deleted.count} registros de csvResult (< 2KB).`);
  } catch (error) {
    console.error('❌ Error en cleanSmallCsvResults:', error);
  }
};

// ---- FUNCIÓN DE ASIGNACIÓN ----
const assignNextPlan = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const availableMachine = await prisma.machine.findFirst({
      where: { status: 'Disponible' },
    });

    if (!availableMachine) return;

    const currentProcessingPlan = await prisma.flightPlan.findFirst({
      where: { machineAssignedId: availableMachine.id, status: 'procesando' },
    });

    if (currentProcessingPlan) {
      console.log(`[INFO] El plan con ID ${currentProcessingPlan.id} sigue en procesamiento.`);
    }

    const nextPlan = await prisma.flightPlan.findFirst({
      where: { status: 'en cola' },
      orderBy: { createdAt: 'asc' },
    });

    if (!nextPlan) return;

    const startTime = new Date().toLocaleString();

    await prisma.flightPlan.update({
      where: { id: nextPlan.id },
      data: {
        status: 'procesando',
        machineAssignedId: availableMachine.id,
      },
    });

    await prisma.machine.update({
      where: { id: availableMachine.id },
      data: { status: 'Ocupada' },
    });

    console.log(`[${startTime}] Asignado plan con ID ${nextPlan.id} a máquina ${availableMachine.id}`);

    // Registrar el tiempo de inicio en el archivo CSV
    fs.appendFileSync(logFile, `${nextPlan.id},${nextPlan.customName},${startTime}\n`);
  } catch (error) {
    console.error("Error al asignar el plan:", error);
  } finally {
    isProcessing = false;
  }
};

// ---- MAIN ----
const main = async () => {
  // Ejecutar asignación cada 10ms
  setInterval(assignNextPlan, 10);

  // Ejecutar limpieza de planes procesados con csvResult < 2KB cada 5 minutos
  setInterval(cleanSmallCsvResults, 60 * 5000);
};

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});
