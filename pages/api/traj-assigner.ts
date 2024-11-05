import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Función para asignar el siguiente plan en la cola
const assignNextPlan = async () => {
  // Buscar el siguiente plan en estado 'en cola' y una máquina disponible
  const nextPlan = await prisma.flightPlan.findFirst({
    where: { status: 'en cola' },
    orderBy: { createdAt: 'asc' },
  });

  if (!nextPlan) return; // No hay planes en cola

  const availableMachine = await prisma.machine.findFirst({
    where: { status: 'Disponible' },
  });

  if (!availableMachine) return; // No hay máquinas disponibles

  try {
    // Asignar el plan a la máquina y actualizar los estados
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

    console.log(`Asignado el plan con ID ${nextPlan.id} a la máquina ${availableMachine.id}`);
    // Procesar el plan (simulamos el procesamiento y la creación del CSV resultante)
    await processFlightPlan(nextPlan.id, availableMachine.id);
  } catch (error) {
    console.error(`Error al asignar el plan con ID ${nextPlan.id}:`, error);
  }
};

// Función para simular el procesamiento del plan y la generación del CSV
const processFlightPlan = async (planId: number, machineId: number) => {
  // Simulación del tiempo de procesamiento
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const csvResult = 'Datos procesados del CSV'; // Simulación del CSV generado

  // Actualizar el plan y la máquina en la base de datos después de procesar
  await prisma.flightPlan.update({
    where: { id: planId },
    data: {
      status: 'procesado',
      csvResult: csvResult,
    },
  });

  await prisma.machine.update({
    where: { id: machineId },
    data: { status: 'Disponible' },
  });

  console.log(`Plan con ID ${planId} procesado y máquina ${machineId} disponible`);
};

// Función principal que se ejecuta periódicamente para asignar planes
const main = async () => {
  // Ejecutar asignaciones cada cierto intervalo
  setInterval(async () => {
    await assignNextPlan();
  }, 1000); // Cada segundo se revisa la cola de planes
};

// Iniciar el asignador de planes
main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});
