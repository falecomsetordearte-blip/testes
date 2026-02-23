// /api/arte/updateStatus.js - COMPLETO E CORRIGIDO

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

        if (!sessionToken || !dealId || !action) {
            return res.status(400).json({ message: 'Parâmetros insuficientes.' });
        }

        // 1. Identificar Empresa via Token
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }
        
        const empresaId = empresas[0].id;
        const idPedido = parseInt(dealId);

        // --- LÓGICA DE AÇÕES ---

        if (action === 'AJUSTES') {
            await prisma.$executeRawUnsafe(`
                UPDATE pedidos 
                SET etapa = 'ARTE', updated_at = NOW()
                WHERE id = $1 AND empresa_id = $2
            `, idPedido, empresaId);

            await prisma.$executeRawUnsafe(`
                UPDATE painel_arte_cards 
                SET coluna = 'AJUSTES', updated_at = NOW()
                WHERE bitrix_deal_id = $1 AND empresa_id = $2
            `, idPedido, empresaId);

            return res.status(200).json({ success: true, message: 'Pedido movido para Ajustes.' });
        } 
        
        else if (action === 'APROVADO') {
            if (!linkArquivo || linkArquivo.trim() === '') {
                return res.status(400).json({ message: 'O link do arquivo é obrigatório para aprovar.' });
            }

            // Atualiza pedido para IMPRESSÃO e salva o link
            await prisma.$executeRawUnsafe(`
                UPDATE pedidos 
                SET etapa = 'IMPRESSÃO', 
                    link_arquivo = $1,
                    updated_at = NOW()
                WHERE id = $2 AND empresa_id = $3
            `, linkArquivo, idPedido, empresaId);

            // Limpa o card do Kanban de Arte
            await prisma.$executeRawUnsafe(`
                DELETE FROM painel_arte_cards 
                WHERE bitrix_deal_id = $1 AND empresa_id = $2
            `, idPedido, empresaId);

            return res.status(200).json({ success: true, message: 'Arte aprovada!', movedToNextStage: true });
        }

        return res.status(400).json({ message: 'Ação inválida.' });

    } catch (error) {
        console.error("Erro em updateStatus:", error);
        return res.status(500).json({ message: 'Erro interno: ' + error.message });
    }
};