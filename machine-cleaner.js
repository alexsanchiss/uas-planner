require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const main = async () => {
  try {
    // 1. Eliminar todas las máquinas
    const machinesDeleted = await prisma.machine.deleteMany({});
    console.log(`✅ Se han eliminado ${machinesDeleted.count} máquinas.`);

    // 2. Reestablecer planes "procesando" a "en cola"
    const plansUpdated = await prisma.flightPlan.updateMany({
      where: { status: "procesando" },
      data: { status: "en cola", machineAssignedId: null }, // quitamos asignación
    });
    console.log(`🔄 Se han reestablecido ${plansUpdated.count} planes a "en cola".`);
    
  } catch (error) {
    console.error("❌ Error durante la limpieza:", error);
  } finally {
    await prisma.$disconnect();
  }
};

main(); 
