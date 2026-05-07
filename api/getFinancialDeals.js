// /api/getFinancialDeals.js - VERSÃO LOCAL (PRISMA)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

    console.log("[Financeiro] Iniciando busca de pedidos locais...");

    try {
        const { sessionToken, page = 0, statusFilter, nameFilter } = req.body;

        if (!sessionToken) return res.status(401).json({ message: 'Acesso não autorizado' });

        // 1. Identificar Empresa pelo Token
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
            if (empresasLegacy.length > 0) empresaId = empresasLegacy[0].id;
        }

        if (!empresaId) {
            console.error("[Financeiro] Empresa não encontrada para o token fornecido.");
            return res.status(401).json({ message: 'Sessão inválida' });
        }

        // 2. Montar Filtro SQL
        let sql = `
            SELECT id, titulo, nome_cliente, status_financeiro, etapa, valor_pago, valor_restante, criado_em, briefing_completo
            FROM pedidos
            WHERE empresa_id = $1
            AND (etapa = 'EXPEDIÇÃO' OR status_financeiro IS NOT NULL)
        `;
        const params = [empresaId];

        if (nameFilter) {
            sql += ` AND (titulo ILIKE $2 OR nome_cliente ILIKE $2)`;
            params.push(`%${nameFilter}%`);
        }

        if (statusFilter && statusFilter !== 'todos') {
            sql += ` AND status_financeiro = $${params.length + 1}`;
            params.push(statusFilter);
        }

        sql += ` ORDER BY id DESC LIMIT 50 OFFSET $${params.length + 1}`;
        params.push(page * 50);

        const pedidos = await prisma.$queryRawUnsafe(sql, ...params);
        
        // Contagem total
        const countSql = `SELECT COUNT(*) as total FROM pedidos WHERE empresa_id = $1 AND (etapa = 'EXPEDIÇÃO' OR status_financeiro IS NOT NULL)`;
        const totalResult = await prisma.$queryRawUnsafe(countSql, empresaId);
        const total = parseInt(totalResult[0].total || 0);

        return res.status(200).json({
            deals: pedidos.map(p => ({
                ID: p.id,
                TITLE: p.titulo || `Pedido #${p.id}`,
                STAGE_ID: p.status_financeiro || 'PENDENTE',
                OPPORTUNITY: p.valor_restante || 0,
                CLIENTE: p.nome_cliente,
                BRIEFING: p.briefing_completo,
                ETAPA_ATUAL: p.etapa
            })),
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / 50),
                totalItems: total
            }
        });

    } catch (error) {
        console.error('[Financeiro] Erro Fatal:', error);
        return res.status(500).json({ message: 'Erro interno ao buscar pedidos locais.' });
    } finally {
        await prisma.$disconnect();
    }
};