require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const main = async () => {
  try {
    const result = await prisma.machine.deleteMany({});
    console.log(`✅ Se han eliminado ${result.count} máquinas.`);
  } catch (error) {
    console.error("❌ Error eliminando máquinas:", error);
  } finally {
    await prisma.$disconnect();
  }
};

main();