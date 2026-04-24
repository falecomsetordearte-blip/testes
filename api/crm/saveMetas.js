const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { 
            sessionToken, mes_ano, meta_mensal, premio_mensal, ajuste_mes, vendido_hoje,
            meta_sem_1, premio_sem_1, sem_1_inicio, sem_1_fim, ajuste_sem_1,
            meta_sem_2, premio_sem_2, sem_2_inicio, sem_2_fim, ajuste_sem_2,
            meta_sem_3, premio_sem_3, sem_3_inicio, sem_3_fim, ajuste_sem_3,
            meta_sem_4, premio_sem_4, sem_4_inicio, sem_4_fim, ajuste_sem_4
        } = req.body;
        
        let empresaId = null;
        const users = await prisma.$queryRawUnsafe(`SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        
        if (users.length > 0) {
            empresaId = users[0].empresa_id;
        } else {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
            if (empresas.length > 0) {
                empresaId = empresas[0].id;
            }
        }

        if (!empresaId) return res.status(403).json({ error: 'Auth Error' });

        await prisma.$executeRawUnsafe(`
            INSERT INTO crm_metas (
                empresa_id, mes_ano, meta_mensal, premio_mensal, ajuste_mes, vendido_hoje,
                meta_sem_1, premio_sem_1, sem_1_inicio, sem_1_fim, ajuste_sem_1,
                meta_sem_2, premio_sem_2, sem_2_inicio, sem_2_fim, ajuste_sem_2,
                meta_sem_3, premio_sem_3, sem_3_inicio, sem_3_fim, ajuste_sem_3,
                meta_sem_4, premio_sem_4, sem_4_inicio, sem_4_fim, ajuste_sem_4,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9::date, $10::date, $11,
                $12, $13, $14::date, $15::date, $16,
                $17, $18, $19::date, $20::date, $21,
                $22, $23, $24::date, $25::date, $26,
                NOW()
            )
            ON CONFLICT (empresa_id, mes_ano) 
            DO UPDATE SET 
                meta_mensal = EXCLUDED.meta_mensal, premio_mensal = EXCLUDED.premio_mensal, ajuste_mes = EXCLUDED.ajuste_mes, vendido_hoje = EXCLUDED.vendido_hoje,
                meta_sem_1 = EXCLUDED.meta_sem_1, premio_sem_1 = EXCLUDED.premio_sem_1, sem_1_inicio = EXCLUDED.sem_1_inicio, sem_1_fim = EXCLUDED.sem_1_fim, ajuste_sem_1 = EXCLUDED.ajuste_sem_1,
                meta_sem_2 = EXCLUDED.meta_sem_2, premio_sem_2 = EXCLUDED.premio_sem_2, sem_2_inicio = EXCLUDED.sem_2_inicio, sem_2_fim = EXCLUDED.sem_2_fim, ajuste_sem_2 = EXCLUDED.ajuste_sem_2,
                meta_sem_3 = EXCLUDED.meta_sem_3, premio_sem_3 = EXCLUDED.premio_sem_3, sem_3_inicio = EXCLUDED.sem_3_inicio, sem_3_fim = EXCLUDED.sem_3_fim, ajuste_sem_3 = EXCLUDED.ajuste_sem_3,
                meta_sem_4 = EXCLUDED.meta_sem_4, premio_sem_4 = EXCLUDED.premio_sem_4, sem_4_inicio = EXCLUDED.sem_4_inicio, sem_4_fim = EXCLUDED.sem_4_fim, ajuste_sem_4 = EXCLUDED.ajuste_sem_4,
                updated_at = NOW()
        `, empresaId, mes_ano, parseFloat(meta_mensal||0), premio_mensal, parseFloat(ajuste_mes||0), parseFloat(vendido_hoje||0),
           parseFloat(meta_sem_1||0), premio_sem_1, sem_1_inicio, sem_1_fim, parseFloat(ajuste_sem_1||0),
           parseFloat(meta_sem_2||0), premio_sem_2, sem_2_inicio, sem_2_fim, parseFloat(ajuste_sem_2||0),
           parseFloat(meta_sem_3||0), premio_sem_3, sem_3_inicio, sem_3_fim, parseFloat(ajuste_sem_3||0),
           parseFloat(meta_sem_4||0), premio_sem_4, sem_4_inicio, sem_4_fim, parseFloat(ajuste_sem_4||0)
        );

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Erro saveMetas:", error);
        return res.status(500).json({ error: 'Erro ao salvar' });
    }
};