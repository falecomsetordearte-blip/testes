// scripts/add-plan-type-field.js
// Migração: adiciona a coluna plan_type nas tabelas empresas e designers_financeiro
// Rode este script UMA VEZ para atualizar o banco de dados.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("Iniciando migração: adicionando coluna plan_type...");

    try {
        // Adiciona plan_type na tabela de empresas
        await prisma.$executeRawUnsafe(`
            ALTER TABLE empresas
            ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'FREE';
        `);
        console.log("✅ Coluna plan_type adicionada em 'empresas'.");

        // Adiciona plan_type na tabela de designers
        await prisma.$executeRawUnsafe(`
            ALTER TABLE designers_financeiro
            ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'FREE';
        `);
        console.log("✅ Coluna plan_type adicionada em 'designers_financeiro'.");

        // Popula retroativamente: empresas com assinatura ACTIVE e chatapp_plano PREMIUM → PRO
        const resPro = await prisma.$executeRawUnsafe(`
            UPDATE empresas
            SET plan_type = 'PRO'
            WHERE assinatura_status = 'ACTIVE' AND chatapp_plano = 'PREMIUM';
        `);
        console.log(`✅ ${resPro} empresa(s) migradas para plan_type = 'PRO'.`);

        // Empresas com assinatura ACTIVE mas sem chatapp_plano PREMIUM → BASIC
        const resBasic = await prisma.$executeRawUnsafe(`
            UPDATE empresas
            SET plan_type = 'BASIC'
            WHERE assinatura_status = 'ACTIVE' AND (chatapp_plano IS NULL OR chatapp_plano != 'PREMIUM');
        `);
        console.log(`✅ ${resBasic} empresa(s) migradas para plan_type = 'BASIC'.`);

        // Designers com assinatura ACTIVE → DESIGNER
        const resDesigner = await prisma.$executeRawUnsafe(`
            UPDATE designers_financeiro
            SET plan_type = 'DESIGNER'
            WHERE assinatura_status = 'ACTIVE';
        `);
        console.log(`✅ ${resDesigner} designer(s) migrados para plan_type = 'DESIGNER'.`);

        console.log("\n✅ Migração concluída com sucesso!");
    } catch (err) {
        console.error("❌ Erro durante a migração:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();
