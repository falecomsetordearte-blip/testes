const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Permite solicitações de qualquer origem
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Metodo nao permitido');

    try {
        const { blobUrl } = req.body;
        if (!blobUrl) return res.status(400).json({ message: 'URL do blob é obrigatória' });

        // Cria a tabela auxiliar caso não exista (Automático e isolado)
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS blob_tracker (
                url TEXT PRIMARY KEY,
                downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // Registra o download (ou atualiza se for o caso, mas o foco é o primeiro)
        await prisma.$executeRawUnsafe(`
            INSERT INTO blob_tracker (url, downloaded_at)
            VALUES ($1, NOW())
            ON CONFLICT (url) DO NOTHING;
        `, blobUrl);

        console.log(`[BlobTracker] Download registrado para: ${blobUrl}`);
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('[BlobTracker Error]:', error);
        return res.status(500).json({ message: 'Erro ao registrar download' });
    } finally {
        await prisma.$disconnect();
    }
};
