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
      orderBy: [
        {
          scheduledAt: { sort: 'asc', nulls: 'last' }, // Prioriza los programados
        },
        {
          createdAt: 'asc', // Luego por orden de creación
        },
        {
          id: 'asc', // Desempate estable (la UI calcula la posición en cola con este mismo orden)
        },
      ],
    });

    if (!nextPlan) return;

    const startTime = new Date().toLocaleString();

    await prisma.flightPlan.update({
      where: { id: nextPlan.id },
      data: {
        status: 'procesando',
        machineAssignedId: availableMachine.id,
        // Reinicia el feedback de un intento anterior; el runner lo vuelve a escribir
        progress: null,
        processingEta: null,
        processingError: null,
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
};

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});
