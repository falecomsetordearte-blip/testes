// /api/arte/updateStatus.js - VERSÃO COMPLETA E ATUALIZADA

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Configuração de CORS para permitir que o front-end acesse a API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Trata requisições de pre-flight (OPTIONS)
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Bloqueia qualquer método que não seja POST
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, dealId, action, linkArquivo } = req.body; 

        // 1. Validação de parâmetros básicos
        if (!sessionToken || !dealId || !action) {
            return res.status(400).json({ message: 'Parâmetros insuficientes na requisição.' });
        }

        // 2. Identificar a Empresa através do sessionToken no Neon
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
        }
        
        const empresaId = empresas[0].id;
        const idPedido = parseInt(dealId);

        // --- LÓGICA DE AÇÕES ---

        // AÇÃO: SOLICITAR AJUSTES
        if (action === 'AJUSTES') {
            // Garante que a etapa global continua em 'ARTE'
            await prisma.$executeRawUnsafe(`
                UPDATE pedidos 
                SET etapa = 'ARTE', updated_at = NOW()
                WHERE id = $1 AND empresa_id = $2
            `, idPedido, empresaId);

            // Move o card interno para a coluna 'AJUSTES' no Kanban de Arte
            await prisma.$executeRawUnsafe(`
                UPDATE painel_arte_cards 
                SET coluna = 'AJUSTES', updated_at = NOW()
                WHERE bitrix_deal_id = $1 AND empresa_id = $2
            `, idPedido, empresaId);

            return res.status(200).json({ 
                success: true, 
                message: 'Pedido movido para Ajustes.', 
                movedToNextStage: false 
            });
        } 
        
        // AÇÃO: APROVAR ARTE E ENVIAR PARA IMPRESSÃO
        else if (action === 'APROVADO') {
            // Validação obrigatória do link do arquivo
            if (!linkArquivo || linkArquivo.trim() === '') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'É obrigatório informar o link do arquivo de impressão para aprovar.' 
                });
            }

            // 1. Atualiza o pedido no banco: Muda etapa para 'IMPRESSÃO' e salva o link
            await prisma.$executeRawUnsafe(`
                UPDATE pedidos 
                SET etapa = 'IMPRESSÃO', 
                    link_arquivo = $1,
                    updated_at = NOW()
                WHERE id = $2 AND empresa_id = $3
            `, linkArquivo, idPedido, empresaId);

            // 2. Remove o card do controle local do Kanban de Arte, 
            // pois o ciclo de arte encerrou e o pedido foi para a fila de impressão.
            await prisma.$executeRawUnsafe(`
                DELETE FROM painel_arte_cards 
                WHERE bitrix_deal_id = $1 AND empresa_id = $2
            `, idPedido, empresaId);

            return res.status(200).json({ 
                success: true, 
                message: 'Arte aprovada! Link salvo e enviado para a fila de impressão.', 
                movedToNextStage: true 
            });
        }

        // Caso a ação enviada não seja reconhecida
        return res.status(400).json({ message: 'Ação solicitada é inválida.' });

    } catch (error) {
        console.error("Erro crítico em /api/arte/updateStatus:", error);
        return res.status(500).json({ 
            message: 'Erro interno ao processar a atualização: ' + error.message 
        });
    }
};