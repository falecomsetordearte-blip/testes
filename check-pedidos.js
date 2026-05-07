const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const p = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'pedidos'");
    console.log(p);
}
run().catch(console.error).finally(()=>prisma.$disconnect());
