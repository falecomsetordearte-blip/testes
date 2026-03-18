const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runSQL() {
    try {
        console.log("Criando a tabela painel_configuracoes_sistema...");
        
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS painel_configuracoes_sistema (
                id SERIAL PRIMARY KEY,
                empresa_id INTEGER NOT NULL UNIQUE,
                prazo_padrao_impressao INTEGER NOT NULL DEFAULT 24,
                prazo_padrao_acabamento INTEGER NOT NULL DEFAULT 24,
                atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        console.log("Tabela criada ou já existente!");
    } catch (e) {
        console.error("Erro ao executar SQL:", e);
    } finally {
        await prisma.$disconnect();
    }
}

runSQL();
