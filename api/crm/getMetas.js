const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeNum = (val) => {
    if (val === null || val === undefined) return 0;
    const num = parseFloat(String(val));
    return isNaN(num) ? 0 : num;
};

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
        
        const metasRaw = await prisma.$queryRawUnsafe(`
            SELECT * FROM crm_metas 
            WHERE empresa_id = $1 AND mes_ano::text = $2 
            LIMIT 1
        `, empresaId, mesAno);
        
        const metas = metasRaw.length > 0 ? metasRaw[0] : null;

        const faturamentoReal = await prisma.$queryRawUnsafe(`
            SELECT COALESCE(SUM(valor_pago + valor_restante), 0) as real_mes
            FROM pedidos 
            WHERE empresa_id = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2
        `, empresaId, mesAno);

        let totalMesCompilado = safeNum(faturamentoReal[0].real_mes);
        let totalHojeCompilado = 0; // Começa com 0, será preenchido pelo valor manual
        let vendasSemanas = { sem1: 0, sem2: 0, sem3: 0, sem4: 0 };

        if (metas) {
            // **MUDANÇA PRINCIPAL: USA O VALOR MANUAL**
            totalHojeCompilado = safeNum(metas.vendido_hoje);

            const ajustesTotal = 
                safeNum(metas.ajuste_mes) +
                safeNum(metas.ajuste_sem_1) +
                safeNum(metas.ajuste_sem_2) +
                safeNum(metas.ajuste_sem_3) +
                safeNum(metas.ajuste_sem_4);

            totalMesCompilado += ajustesTotal;

            const realSemanas = await prisma.$queryRawUnsafe(`
                SELECT 
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $2::date AND DATE(created_at) <= $3::date), 0) as r1,
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $4::date AND DATE(created_at) <= $5::date), 0) as r2,
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $6::date AND DATE(created_at) <= $7::date), 0) as r3,
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $8::date AND DATE(created_at) <= $9::date), 0) as r4
                FROM pedidos WHERE empresa_id = $1
            `, empresaId, 
               metas.sem_1_inicio, metas.sem_1_fim, 
               metas.sem_2_inicio, metas.sem_2_fim,
               metas.sem_3_inicio, metas.sem_3_fim, 
               metas.sem_4_inicio, metas.sem_4_fim);
            
            vendasSemanas.sem1 = safeNum(realSemanas[0].r1) + safeNum(metas.ajuste_sem_1);
            vendasSemanas.sem2 = safeNum(realSemanas[0].r2) + safeNum(metas.ajuste_sem_2);
            vendasSemanas.sem3 = safeNum(realSemanas[0].r3) + safeNum(metas.ajuste_sem_3);
            vendasSemanas.sem4 = safeNum(realSemanas[0].r4) + safeNum(metas.ajuste_sem_4);
        }

        return res.status(200).json({
            metas: metas,
            total_mes: totalMesCompilado,
            total_hoje: totalHojeCompilado, // Retorna o valor manual
            vendas_semanas: vendasSemanas
        });

    } catch (error) {
        console.error("Erro getMetas consolidado:", error);
        return res.status(500).json({ error: 'Erro ao consolidar faturamento e metas' });
    }
};