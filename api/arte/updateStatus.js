// /api/arte/updateStatus.js - CORRIGIDO AUTENTICAÇÃO FUNCIONÁRIOS
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { enviarNotificacaoEtapa } = require('../helpers/chatapp');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, dealId, action, linkArquivo } = req.body; 

        if (!sessionToken || !dealId || !action) return res.status(400).json({ message: 'Parâmetros insuficientes.' });

        // 1. Validar Sessão (DUPLA CHECAGEM: Funcionários e Donos)
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if(users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const legacy = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if(legacy.length > 0) empresaId = legacy[0].id;
        }

        if (!empresaId) return res.status(401).json({ message: 'Sessão inválida.' });
        
        const idPedido = parseInt(dealId);

        if (action === 'AJUSTES') {
            await prisma.$executeRawUnsafe(`UPDATE pedidos SET etapa = 'ARTE', updated_at = NOW() WHERE id = $1 AND empresa_id = $2`, idPedido, empresaId);
            await prisma.$executeRawUnsafe(`UPDATE painel_arte_cards SET coluna = 'AJUSTES', updated_at = NOW() WHERE bitrix_deal_id = $1 AND empresa_id = $2`, idPedido, empresaId);
            return res.status(200).json({ success: true, message: 'Pedido movido para Ajustes.' });
        } 
        else if (action === 'APROVADO') {
            if (!linkArquivo || linkArquivo.trim() === '') return res.status(400).json({ message: 'O link do arquivo é obrigatório para aprovar.' });

            await prisma.$executeRawUnsafe(`UPDATE pedidos SET etapa = 'IMPRESSÃO', link_arquivo_impressao = $1, updated_at = NOW() WHERE id = $2 AND empresa_id = $3`, linkArquivo, idPedido, empresaId);
            await prisma.$executeRawUnsafe(`DELETE FROM painel_arte_cards WHERE bitrix_deal_id = $1 AND empresa_id = $2`, idPedido, empresaId);

            try { await enviarNotificacaoEtapa(idPedido, 'IMPRESSÃO'); } catch (e) {}

            return res.status(200).json({ success: true, message: 'Arte aprovada!', movedToNextStage: true });
        }

        return res.status(400).json({ message: 'Ação inválida.' });

    } catch (error) {
        console.error("Erro em updateStatus:", error);
        return res.status(500).json({ message: 'Erro interno: ' + error.message });
    }
};