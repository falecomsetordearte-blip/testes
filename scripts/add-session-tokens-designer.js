const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Adicionando coluna session_tokens na tabela designers_financeiro...");
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE designers_financeiro 
            ADD COLUMN IF NOT EXISTS session_tokens TEXT
        `);
        console.log("OK!");
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
