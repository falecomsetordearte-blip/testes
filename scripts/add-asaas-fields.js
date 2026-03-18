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
            ADD COLUMN IF NOT EXISTS assinatura_status VARCHAR(50) DEFAULT 'INATIVO',
            ADD COLUMN IF NOT EXISTS chave_pix VARCHAR(255),
            ADD COLUMN IF NOT EXISTS pontuacao INTEGER DEFAULT 0;
        `);
        console.log("Tabela designers_financeiro atualizada com sucesso!");

        console.log("Criando tabela acertos_contas...");
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS acertos_contas (
                id SERIAL PRIMARY KEY,
                empresa_id INTEGER NOT NULL,
                designer_id INTEGER NOT NULL,
                pedido_id INTEGER NOT NULL,
                valor DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'PENDENTE',
                comprovante_url TEXT,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                pago_em TIMESTAMP
            );
        `);
        console.log("Tabela acertos_contas criada ou já existente!");

    } catch (e) {
        console.error("Erro ao alterar tabelas:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
