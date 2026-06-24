const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const cols = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'pedidos'");
    console.log(cols.map(c => c.column_name).join(', '));
    await prisma.$disconnect();
}
main().catch(console.error);
