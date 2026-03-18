// scripts/add-asaas-fields.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Iniciando adição de colunas Asaas (RESTAURAÇÃO)...");

    try {
        console.log("Alterando tabela empresas...");
        await prisma.$executeRawUnsafe(`
            ALTER TABLE empresas
            ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS asaas_subscription_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS assinatura_status VARCHAR(50) DEFAULT 'INATIVO';
        `);
        console.log("Tabela empresas atualizada com sucesso!");

        console.log("Alterando tabela designers_financeiro...");
        await prisma.$executeRawUnsafe(`
            ALTER TABLE designers_financeiro
            ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS asaas_subscription_id VARCHAR(255),
            ADD COLUMN IF NOT EXISTS assinatura_status VARCHAR(50) DEFAULT 'INATIVO';
        `);
        console.log("Tabela designers_financeiro atualizada com sucesso!");

    } catch (e) {
        console.error("Erro ao alterar tabelas:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
