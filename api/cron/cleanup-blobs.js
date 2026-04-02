const { PrismaClient } = require('@prisma/client');
const { list, del } = require('@vercel/blob');

const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Apenas Vercel CRON ou requests autorizadas podem rodar
    // (Pode-se adicionar um cabeçalho de autorização se necessário)
    
    console.log('[Cleanup] Iniciando limpeza automatizada do Vercel Blob...');

    try {
        // 1. Garantir que a tabela BlobTracker existe
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS blob_tracker (
                url TEXT PRIMARY KEY,
                downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // 2. Listar todos os arquivos no Blob
        const { blobs } = await list();
        const agora = new Date();
        const limiteGlobal = 7 * 24 * 60 * 60 * 1000; // 7 dias
        const limiteDownload = 3 * 24 * 60 * 60 * 1000; // 3 dias

        let deletadosCount = 0;

        for (const blob of blobs) {
            const idadeCriacao = agora - new Date(blob.uploadedAt);
            let deveDeletar = false;

            // Regra 1: Mais de 7 dias de idade (Independente de tudo)
            if (idadeCriacao > limiteGlobal) {
                deveDeletar = true;
                console.log(`[Rule: 7 Days] Marcado para deleção: ${blob.url}`);
            } else {
                // Regra 2: Verificação de Download (3 dias após download)
                const tracker = await prisma.$queryRawUnsafe(`
                    SELECT downloaded_at FROM blob_tracker WHERE url = $1 LIMIT 1
                `, blob.url);

                if (tracker.length > 0) {
                    const idadeDownload = agora - new Date(tracker[0].downloaded_at);
                    if (idadeDownload > limiteDownload) {
                        deveDeletar = true;
                        console.log(`[Rule: 3 Days Post-Download] Marcado para deleção: ${blob.url}`);
                    }
                }
            }

            if (deveDeletar) {
                try {
                    await del(blob.url);
                    deletadosCount++;
                    // Remove do tracker também
                    await prisma.$executeRawUnsafe(`DELETE FROM blob_tracker WHERE url = $1`, blob.url);
                } catch (errDel) {
                    console.error(`[Error Deleting] Corrupt or missing blob: ${blob.url}`, errDel.message);
                }
            }
        }

        // Limpeza de trackers órfãos (arquivos que sumiram mas ficaram no DB)
        // Opcional, para manter o banco limpo
        await prisma.$executeRawUnsafe(`
            DELETE FROM blob_tracker 
            WHERE url NOT IN (SELECT url FROM (SELECT unnest($1::text[]) as url) as t)
        `, blobs.map(b => b.url));

        console.log(`[Cleanup OK] Processo finalizado. ${deletadosCount} arquivos removidos.`);
        return res.status(200).json({ success: true, deleted: deletadosCount });

    } catch (error) {
        console.error('[Cleanup Error]:', error);
        return res.status(500).json({ message: 'Erro interno na limpeza de blobs' });
    } finally {
        await prisma.$disconnect();
    }
};
