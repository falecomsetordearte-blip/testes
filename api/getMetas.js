const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken } = req.body;
        const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length === 0) return res.status(403).json({ error: 'Auth Error' });
        const empresaId = empresas[0].id;

        const hoje = new Date();
        const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

        // Busca as metas configuradas
        const metas = await prisma.$queryRawUnsafe(`SELECT * FROM crm_metas WHERE empresa_id = $1 AND mes_ano = $2 LIMIT 1`, empresaId, mesAno);

        // Calcula total vendido no MÊS (Soma de todos os cards criados ou atualizados no mês)
        // OBS: Ajuste a regra de negócio do que é considerado "Vendido" (ex: WHERE coluna = 'Aguardando Pagamento') se necessário.
        const progressoMes = await prisma.$queryRawUnsafe(`
            SELECT COALESCE(SUM(valor_orcamento), 0) as total 
            FROM crm_oportunidades 
            WHERE empresa_id = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2
        `, empresaId, mesAno);

        // Calcula total vendido HOJE
        const dataHojeStr = hoje.toISOString().split('T')[0];
        const progressoHoje = await prisma.$queryRawUnsafe(`
            SELECT COALESCE(SUM(valor_orcamento), 0) as total 
            FROM crm_oportunidades 
            WHERE empresa_id = $1 AND TO_CHAR(created_at, 'YYYY-MM-DD') = $2
        `, empresaId, dataHojeStr);

        return res.status(200).json({
            metas: metas.length > 0 ? metas[0] : null,
            total_mes: parseFloat(progressoMes[0].total),
            total_hoje: parseFloat(progressoHoje[0].total)
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao buscar metas' });
    }
};