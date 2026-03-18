const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Iniciando criação da tabela acertos_contas...");
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS public.acertos_contas (
                id SERIAL PRIMARY KEY,
                empresa_id INTEGER NOT NULL,
                designer_id INTEGER NOT NULL,
                pedido_id INTEGER NOT NULL,
                valor DECIMAL(10,2) NOT NULL,
                status VARCHAR(255) NOT NULL DEFAULT 'PENDENTE',
                comprovante_url TEXT,
                criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                pago_em TIMESTAMP(3),
                CONSTRAINT acertos_contas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON UPDATE CASCADE ON DELETE RESTRICT
            );
        `);
        console.log("Tabela acertos_contas garantida com sucesso!");
    } catch (e) {
        console.error("Erro ao criar a tabela:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
