// /api/impressao/getDeals.js - VERSÃO COMPLETA E ATUALIZADA

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // Configuração de CORS para permitir acesso do frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Trata requisições de pre-flight
    if (req.method === 'OPTIONS') return res.status(200).end();

    // Bloqueia qualquer método que não seja POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { sessionToken, impressoraFilter, materialFilter } = req.body;

        // 1. Validação de Token
        if (!sessionToken) {
            return res.status(401).json({ message: 'Token de sessão é obrigatório.' });
        }

        // 2. Identificar a Empresa através do sessionToken no Neon
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) {
            return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
        }
        
        const empresaId = empresas[0].id;

        // 3. Montar a Query SQL com Filtros Dinâmicos
        // Buscamos apenas pedidos cuja etapa global seja 'IMPRESSÃO'
        let querySql = `
            SELECT * FROM pedidos 
            WHERE empresa_id = $1 
            AND etapa = 'IMPRESSÃO'
        `;
        
        const queryParams = [empresaId];

        // Adiciona filtro de Impressora se houver
        if (impressoraFilter && impressoraFilter !== "") {
            querySql += ` AND impressora_id = $${queryParams.length + 1}`;
            queryParams.push(impressoraFilter);
        }

        // Adiciona filtro de Material se houver
        if (materialFilter && materialFilter !== "") {
            querySql += ` AND material_id = $${queryParams.length + 1}`;
            queryParams.push(materialFilter);
        }

        // Ordenação por ID decrescente (mais recentes primeiro)
        querySql += ` ORDER BY id DESC`;

        const pedidos = await prisma.$queryRawUnsafe(querySql, ...queryParams);

        // 4. Mapeamento para o formato esperado pelo Frontend (painel-script.js)
        // Mantemos os nomes de campos UF_CRM_... para não quebrar o layout existente
        const dealsFormatados = pedidos.map(p => ({
            ID: p.id,
            TITLE: p.titulo || String(p.id),
            STAGE_ID: p.etapa,
            'UF_CRM_1757756651931': p.status_impressao || '2659', // Status interno (Padrão: Na Fila)
            'UF_CRM_1741273407628': p.nome_cliente || 'Cliente não informado',
            'UF_CRM_1749481565243': p.whatsapp_cliente || '',
            'UF_CRM_1752712769666': '', // Link Atendimento (Placeholder)
            'UF_CRM_1727464924690': '', // Medidas (Placeholder)
            'UF_CRM_1748277308731': p.link_arquivo || '', // O LINK SALVO PELA ARTE APARECE AQUI
            'UF_CRM_1757794109': p.data_entrega, // Prazo final para as colunas do Kanban
            'UF_CRM_1738249371': p.briefing_completo || 'Sem briefing disponível.'
        }));

        // 5. Retorno final com a lista e o ID da empresa (necessário para lógicas internas do front)
        return res.status(200).json({ 
            deals: dealsFormatados,
            localCompanyId: empresaId 
        });

    } catch (error) {
        console.error('[getDeals Impressão] Erro crítico:', error);
        return res.status(500).json({ 
            message: 'Erro interno ao buscar dados de impressão: ' + error.message 
        });
    }
};