// /api/expedicao/listar.js - COMPLETO E ATUALIZADO
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, query } = req.body;

        // 1. Identificar Empresa pelo Token
        const empresas = await prisma.$queryRawUnsafe(`
            SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${sessionToken}%`);

        if (empresas.length === 0) return res.status(403).json({ message: 'Sessão inválida' });
        const empresaId = empresas[0].id;

        // 2. Montar Query de busca
        let sql = `
            SELECT id, titulo, nome_cliente, whatsapp_cliente, briefing_completo, 
                   status_expedicao, valor_pago, valor_restante 
            FROM pedidos /* cache-bust-exp-v1 */
            WHERE empresa_id = $1 
            AND etapa = 'EXPEDIÇÃO'
        `;
        const params = [empresaId];

        if (query) {
            sql += ` AND (titulo ILIKE $2 OR nome_cliente ILIKE $2)`;
            params.push(`%${query}%`);
        }

        sql += ` ORDER BY id DESC`;

        const pedidos = await prisma.$queryRawUnsafe(sql, ...params);

        // 3. Mapear para o formato que o seu expedicao/script.js espera
        const deals = pedidos.map(p => ({
            id_interno: p.id,
            titulo: p.titulo || String(p.id),
            nome_cliente: p.nome_cliente,
            whatsapp: p.whatsapp_cliente,
            briefing: p.briefing_completo,
            status_expedicao: p.status_expedicao,
            valor_pago: parseFloat(p.valor_pago || 0),
            valor_restante: parseFloat(p.valor_restante || 0)
        }));

        return res.status(200).json({ 
            deals: deals, 
            localCompanyId: empresaId 
        });

    } catch (error) {
        console.error("Erro Expedição Listar:", error);
        return res.status(500).json({ message: 'Erro ao listar dados.' });
    }
};