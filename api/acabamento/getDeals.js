// /api/acabamento/getDeals.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido.' });

    try {
        const { sessionToken, impressoraFilter, materialFilter } = req.body;

        // 1. Identificar Empresa via Token
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

        // 2. Query SQL com Cache Bust e Filtros
        let querySql = `
            SELECT id, titulo, etapa, nome_cliente, whatsapp_cliente, 
                   link_layout, data_entrega, briefing_completo, tipo_entrega
            FROM pedidos /* cache-bust-acabamento-v1 */
            WHERE empresa_id = $1 
            AND etapa = 'ACABAMENTO'
        `;
        const queryParams = [empresaId];

        if (impressoraFilter) {
            querySql += ` AND impressora_id = $${queryParams.length + 1}`;
            queryParams.push(impressoraFilter);
        }
        if (materialFilter) {
            querySql += ` AND material_id = $${queryParams.length + 1}`;
            queryParams.push(materialFilter);
        }

        const pedidos = await prisma.$queryRawUnsafe(querySql, ...queryParams);

        // 3. Mapear para chaves do Bitrix (Compatibilidade com acabamento-script.js)
        const deals = [];
        
        let prazoPadraoAcabamento = null;

        for (const p of pedidos) {
            let dataEntregaAtual = p.data_entrega;

            // Se o pedido CAIU no Acabamento e AINDA NÃO TEM PRAZO, injetamos agora!
            if (!dataEntregaAtual) {
                if (prazoPadraoAcabamento === null) {
                    const configs = await prisma.$queryRawUnsafe(`
                        SELECT prazo_padrao_acabamento FROM painel_configuracoes_sistema WHERE empresa_id = $1 LIMIT 1
                    `, empresaId);
                    prazoPadraoAcabamento = configs.length > 0 ? (configs[0].prazo_padrao_acabamento || 24) : 24;
                }

                const agora = new Date();
                agora.setHours(agora.getHours() + parseInt(prazoPadraoAcabamento));
                dataEntregaAtual = agora;

                await prisma.$executeRawUnsafe(`
                    UPDATE pedidos SET data_entrega = $1 WHERE id = $2
                `, dataEntregaAtual, p.id);
            }

            deals.push({
                ID: p.id,
                TITLE: p.titulo || String(p.id),
                STAGE_ID: p.etapa,
                'UF_CRM_1741273407628': p.nome_cliente,
                'UF_CRM_1749481565243': p.whatsapp_cliente,
                'UF_CRM_1727464924690': '', // Medidas
                'UF_CRM_1764124589418': p.link_layout || '',
                'UF_CRM_1757794109': dataEntregaAtual, // Prazo Final
                'UF_CRM_1738249371': p.briefing_completo
            });
        }

        return res.status(200).json({ 
            deals: deals,
            localCompanyId: empresaId 
        });

    } catch (error) {
        console.error('[getDeals Acabamento] Erro:', error);
        return res.status(500).json({ message: 'Erro ao carregar acabamento.' });
    }
};