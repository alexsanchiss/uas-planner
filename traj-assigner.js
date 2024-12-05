const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
let isProcessing = false;

const assignNextPlan = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const nextPlan = await prisma.flightPlan.findFirst({
      where: { status: 'en cola' },
      orderBy: { createdAt: 'asc' },
    });

    if (!nextPlan) return;

    const availableMachine = await prisma.machine.findFirst({
      where: { status: 'Disponible' },
    });

    if (!availableMachine) return;

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

    console.log(`Asignado el plan con ID ${nextPlan.id} a la máquina con ID ${availableMachine.id}`);
  } catch (error) {
    console.error("Error al asignar el plan:", error);
  } finally {
    isProcessing = false;
  }
};

const main = async () => {
  setInterval(async () => {
    await assignNextPlan();
  }, 1000);
};

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});