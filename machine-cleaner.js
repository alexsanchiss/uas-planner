require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const main = async () => {
  try {
    // 1. Eliminar todas las máquinas
    const machinesDeleted = await prisma.machine.deleteMany({});
    console.log(`✅ Se han eliminado ${machinesDeleted.count} máquinas.`);

    // 2. Reestablecer planes "procesando" a "en cola"
    const plansProcessingReset = await prisma.flightPlan.updateMany({
      where: { status: "procesando" },
      data: { status: "en cola", machineAssignedId: null, csvResult: "" },
    });
    console.log(`🔄 Se han reestablecido ${plansProcessingReset.count} planes en estado "procesando" a "en cola".`);

    // 3. Buscar planes en csvResult cuyo contenido pese menos de 2 KB
    const smallCsvPlans = await prisma.csvResult.findMany();
    const smallIds = smallCsvPlans
      .filter(p => p.csvResult && Buffer.byteLength(p.csvResult, "utf8") < 2048)
      .map(p => p.id);

    if (smallIds.length > 0) {
      const plansCsvReset = await prisma.flightPlan.updateMany({
        where: { id: { in: smallIds } },
        data: { status: "en cola", machineAssignedId: null, csvResult: "" },
      });
      console.log(`📉 Se han reestablecido ${plansCsvReset.count} planes con csvResult < 2KB a "en cola".`);
    } else {
      console.log("📁 No hay planes con csvResult menor de 2KB.");
    }

  } catch (error) {
    console.error("❌ Error durante la limpieza:", error);
  } finally {
    await prisma.$disconnect();
  }
};

main();
