// /api/impressao/getDeals.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, impressoraFilter, materialFilter } = req.body;
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const empresasLegacy = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${sessionToken}%`);
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
            }
        }

        if (!empresaId) return res.status(401).json({ message: 'Sessão inválida.' });

        // Query com campos específicos corrigida para ler link_arquivo_impressao
        let querySql = `
            SELECT id, titulo, etapa, status_impressao, nome_cliente, 
                   whatsapp_cliente, link_arquivo_impressao, data_entrega, briefing_completo,
                   impressoras_ids
            FROM pedidos /* cache-bust-v4-port */
            WHERE empresa_id = $1 
            AND etapa = 'IMPRESSÃO'
        `;
        const queryParams = [empresaId];

        const pedidos = await prisma.$queryRawUnsafe(querySql, ...queryParams);

        let pedidosFiltrados = pedidos;

        if (impressoraFilter && impressoraFilter !== 'cadastrar') {
            pedidosFiltrados = pedidos.filter(p => {
                const ids = p.impressoras_ids || [];
                // Compatibilidade com array de string ou number vindo do JSONB
                return ids.map(String).includes(String(impressoraFilter));
            });
        }

        const dealsFormatados = [];
        
        let prazoPadraoImpressao = null;

        for (const p of pedidosFiltrados) {
            let dataEntregaAtual = p.data_entrega;

            // Se o pedido CAIU na Impressão e AINDA NÃO TEM PRAZO, injetamos agora!
            if (!dataEntregaAtual) {
                // Busca a config apenas uma vez se precisar
                if (prazoPadraoImpressao === null) {
                    const configs = await prisma.$queryRawUnsafe(`
                        SELECT prazo_padrao_impressao FROM painel_configuracoes_sistema WHERE empresa_id = $1 LIMIT 1
                    `, empresaId);
                    prazoPadraoImpressao = configs.length > 0 ? (configs[0].prazo_padrao_impressao || 24) : 24;
                }

                // Calcula: NOW() + prazoPadraoImpressao horas
                const agora = new Date();
                agora.setHours(agora.getHours() + parseInt(prazoPadraoImpressao));
                dataEntregaAtual = agora;

                // Atualiza no banco silenciosamente
                await prisma.$executeRawUnsafe(`
                    UPDATE pedidos SET data_entrega = $1 WHERE id = $2
                `, dataEntregaAtual, p.id);
            }

            dealsFormatados.push({
                ID: p.id,
                TITLE: p.titulo || String(p.id),
                STAGE_ID: p.etapa,
                'UF_CRM_1757756651931': p.status_impressao || '2659',
                'UF_CRM_1741273407628': p.nome_cliente,
                'UF_CRM_1749481565243': p.whatsapp_cliente,
                'UF_CRM_1748277308731': p.link_arquivo_impressao || '',
                'UF_CRM_1757794109': dataEntregaAtual, // Retorna a nova data para o front
                'UF_CRM_1738249371': p.briefing_completo,
                'impressoras_ids': p.impressoras_ids || []
            });
        }

        return res.status(200).json({ deals: dealsFormatados, localCompanyId: empresaId });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};