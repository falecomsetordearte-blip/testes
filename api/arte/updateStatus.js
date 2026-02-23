// /api/arte/updateStatus.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, dealId, action, linkArquivo } = req.body; 

        // 1. Auth
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(401).json({ message: 'Sessão inválida.' });
        const empresaId = empresas[0].id;

        // 2. Lógica de Ações
        if (action === 'AJUSTES') {
            await prisma.$executeRawUnsafe(`
                UPDATE pedidos SET etapa = 'AJUSTES', updated_at = NOW()
                WHERE id = $1 AND empresa_id = $2
            `, parseInt(dealId), empresaId);
            
            return res.status(200).json({ success: true, message: 'Movido para Ajustes.', movedToNextStage: false });
        } 
        
        else if (action === 'APROVADO') {
            if (!linkArquivo) return res.status(400).json({ message: 'Link do arquivo é obrigatório.' });

            // Atualiza no banco: Muda etapa para IMPRESSÃO e anexa o link ao briefing (ou coluna de arquivo se tiver)
            // Aqui vamos atualizar o briefing_completo adicionando o link no final para não perder dados
            await prisma.$executeRawUnsafe(`
                UPDATE pedidos 
                SET etapa = 'IMPRESSÃO', 
                    briefing_completo = briefing_completo || E'\n\n=== ARQUIVO APROVADO ===\nLink: ' || $1,
                    updated_at = NOW()
                WHERE id = $2 AND empresa_id = $3
            `, linkArquivo, parseInt(dealId), empresaId);

            return res.status(200).json({ success: true, message: 'Arte aprovada e enviada para impressão!', movedToNextStage: true });
        }

        return res.status(400).json({ message: 'Ação inválida.' });

    } catch (error) {
        console.error("Erro updateStatus:", error);
        return res.status(500).json({ message: 'Erro ao processar ação.' });
    }
};