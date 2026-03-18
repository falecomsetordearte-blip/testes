// api/auth/migrate-sql.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    try {
        console.log("Iniciando migração via API...");
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "aceite_termos" (
                "id" SERIAL PRIMARY KEY,
                "usuario_id" INTEGER NOT NULL,
                "tipo_usuario" TEXT NOT NULL,
                "versao" TEXT NOT NULL DEFAULT 'v1.0',
                "aceito_em" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        return res.status(200).json({ success: true, message: 'Tabela aceite_termos criada ou já existente.' });
    } catch (error) {
        console.error("Erro migração SQL:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
