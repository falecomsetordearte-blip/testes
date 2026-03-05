// addVendaHoje.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, valor } = req.body;
        
        if (!valor || isNaN(valor) || valor <= 0) {
            return res.status(400).json({ error: 'Valor inválido' });
        }

        // Identifica a empresa
        const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length === 0) return res.status(403).json({ error: 'Auth Error' });
        const empresaId = empresas[0].id;

        const hoje = new Date();
        const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        
        // Faz o UPDATE somando o valor ao vendido_hoje existente
        const updateCount = await prisma.$executeRawUnsafe(`
            UPDATE crm_metas 
            SET vendido_hoje = COALESCE(vendido_hoje, 0) + $1,
                updated_at = NOW()
            WHERE empresa_id = $2 AND mes_ano::text = $3
        `, parseFloat(valor), empresaId, mesAno);

        if (updateCount === 0) {
            return res.status(400).json({ error: 'Metas deste mês ainda não foram configuradas.' });
        }

        return res.status(200).json({ success: true, message: 'Venda lançada com sucesso!' });

    } catch (error) {
        console.error("Erro addVendaHoje:", error);
        return res.status(500).json({ error: 'Erro ao lançar venda' });
    }
};