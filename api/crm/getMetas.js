const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken } = req.body;
        
        // 1. Identifica a empresa pelo token
        const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length === 0) return res.status(403).json({ error: 'Auth Error' });
        const empresaId = empresas[0].id;

        const hoje = new Date();
        const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const dataHojeStr = hoje.toISOString().split('T')[0];

        // 2. Busca as metas e períodos configurados
        const metasRaw = await prisma.$queryRawUnsafe(`SELECT * FROM crm_metas WHERE empresa_id = $1 AND mes_ano = $2 LIMIT 1`, empresaId, mesAno);
        const metas = metasRaw.length > 0 ? metasRaw[0] : null;

        // 3. Calcula total vendido no MÊS e HOJE (Soma de valor_pago + valor_restante na tabela pedidos)
        // Usamos COALESCE para retornar 0 caso não haja registros
        const globais = await prisma.$queryRawUnsafe(`
            SELECT 
                COALESCE(SUM(valor_pago + valor_restante), 0) as total_mes,
                COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) = $3::date), 0) as total_hoje
            FROM pedidos 
            WHERE empresa_id = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2
        `, empresaId, mesAno, dataHojeStr);

        let totalSemanas = { sem1: 0, sem2: 0, sem3: 0, sem4: 0 };

        // 4. Calcula as vendas ISOLADAS de cada semana baseada nas datas do admin
        if (metas) {
            const sumSemanas = await prisma.$queryRawUnsafe(`
                SELECT 
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $2::date AND DATE(created_at) <= $3::date), 0) as sem1,
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $4::date AND DATE(created_at) <= $5::date), 0) as sem2,
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $6::date AND DATE(created_at) <= $7::date), 0) as sem3,
                    COALESCE(SUM(valor_pago + valor_restante) FILTER (WHERE DATE(created_at) >= $8::date AND DATE(created_at) <= $9::date), 0) as sem4
                FROM pedidos WHERE empresa_id = $1
            `, empresaId, 
               metas.sem_1_inicio, metas.sem_1_fim, metas.sem_2_inicio, metas.sem_2_fim,
               metas.sem_3_inicio, metas.sem_3_fim, metas.sem_4_inicio, metas.sem_4_fim);
            
            totalSemanas = sumSemanas[0];
        }

        return res.status(200).json({
            metas: metas,
            total_mes: parseFloat(globais[0].total_mes),
            total_hoje: parseFloat(globais[0].total_hoje),
            vendas_semanas: {
                sem1: parseFloat(totalSemanas.sem1), 
                sem2: parseFloat(totalSemanas.sem2),
                sem3: parseFloat(totalSemanas.sem3), 
                sem4: parseFloat(totalSemanas.sem4)
            }
        });

    } catch (error) {
        console.error("Erro getMetas:", error);
        return res.status(500).json({ error: 'Erro ao processar cálculos de metas' });
    }
};