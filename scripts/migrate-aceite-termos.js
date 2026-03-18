// scripts/migrate-aceite-termos.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Criando tabela aceite_termos ---");
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "aceite_termos" (
                "id" SERIAL PRIMARY KEY,
                "usuario_id" INTEGER NOT NULL,
                "tipo_usuario" TEXT NOT NULL,
                "versao" TEXT NOT NULL DEFAULT 'v1.0',
                "aceito_em" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabela criada com sucesso!");
    } catch (error) {
        console.error("Erro ao criar tabela:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
