const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken } = req.body;
        
        // 1. Identifica a empresa
        const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length === 0) return res.status(403).json({ error: 'Auth Error' });
        const empresaId = empresas[0].id;

        const hoje = new Date();
        const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const dataHojeStr = hoje.toISOString().split('T')[0];

        // 2. Busca as metas e os AJUSTES MANUAIS
        const metasRaw = await prisma.$queryRawUnsafe(`SELECT * FROM crm_metas WHERE empresa_id = $1 AND mes_ano = $2 LIMIT 1`, empresaId, mesAno);
        const metas = metasRaw.length > 0 ? metasRaw[0] : null;

        // 3. Calcula Faturamento Real (Pedidos)
        const faturamentoReal = await prisma.$queryRawUnsafe(`
            SELECT 
                COALESCE(SUM(valor_pago + valor_restante), 0) as real_mes,
                COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) = $3::date), 0) as real_hoje
            FROM pedidos 
            WHERE empresa_id = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2
        `, empresaId, mesAno, dataHojeStr);

        let totalMesCompilado = parseFloat(faturamentoReal[0].real_mes);
        let totalHojeCompilado = parseFloat(faturamentoReal[0].real_hoje);
        let vendasSemanas = { sem1: 0, sem2: 0, sem3: 0, sem4: 0 };

        if (metas) {
            // Soma o Ajuste Mensal ao faturamento real do mês
            totalMesCompilado += parseFloat(metas.ajuste_mes || 0);

            // Calcula faturamento real por semana e soma o ajuste de cada uma
            const realSemanas = await prisma.$queryRawUnsafe(`
                SELECT 
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $2::date AND DATE(created_at) <= $3::date), 0) as r1,
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $4::date AND DATE(created_at) <= $5::date), 0) as r2,
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $6::date AND DATE(created_at) <= $7::date), 0) as r3,
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $8::date AND DATE(created_at) <= $9::date), 0) as r4
                FROM pedidos WHERE empresa_id = $1
            `, empresaId, 
               metas.sem_1_inicio, metas.sem_1_fim, metas.sem_2_inicio, metas.sem_2_fim,
               metas.sem_3_inicio, metas.sem_3_fim, metas.sem_4_inicio, metas.sem_4_fim);
            
            vendasSemanas.sem1 = parseFloat(realSemanas[0].r1) + parseFloat(metas.ajuste_sem_1 || 0);
            vendasSemanas.sem2 = parseFloat(realSemanas[0].r2) + parseFloat(metas.ajuste_sem_2 || 0);
            vendasSemanas.sem3 = parseFloat(realSemanas[0].r3) + parseFloat(metas.ajuste_sem_3 || 0);
            vendasSemanas.sem4 = parseFloat(realSemanas[0].r4) + parseFloat(metas.ajuste_sem_4 || 0);
        }

        return res.status(200).json({
            metas: metas,
            total_mes: totalMesCompilado,
            total_hoje: totalHojeCompilado,
            vendas_semanas: vendasSemanas
        });

    } catch (error) {
        console.error("Erro getMetas consolidado:", error);
        return res.status(500).json({ error: 'Erro ao consolidar faturamento e metas' });
    }
};