const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { 
            sessionToken, mes_ano, meta_mensal, premio_mensal, 
            meta_sem_1, premio_sem_1, sem_1_inicio, sem_1_fim,
            meta_sem_2, premio_sem_2, sem_2_inicio, sem_2_fim,
            meta_sem_3, premio_sem_3, sem_3_inicio, sem_3_fim,
            meta_sem_4, premio_sem_4, sem_4_inicio, sem_4_fim
        } = req.body;
        
        // 1. Identifica a empresa
        const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length === 0) return res.status(403).json({ error: 'Auth Error' });
        const empresaId = empresas[0].id;

        // 2. Executa o Insert ou Update (Upsert)
        await prisma.$executeRawUnsafe(`
            INSERT INTO crm_metas (
                empresa_id, mes_ano, meta_mensal, premio_mensal, 
                meta_sem_1, premio_sem_1, sem_1_inicio, sem_1_fim,
                meta_sem_2, premio_sem_2, sem_2_inicio, sem_2_fim,
                meta_sem_3, premio_sem_3, sem_3_inicio, sem_3_fim,
                meta_sem_4, premio_sem_4, sem_4_inicio, sem_4_fim,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11::date, $12::date, $13, $14, $15::date, $16::date, $17, $18, $19::date, $20::date, NOW())
            ON CONFLICT (empresa_id, mes_ano) 
            DO UPDATE SET 
                meta_mensal = EXCLUDED.meta_mensal, 
                premio_mensal = EXCLUDED.premio_mensal,
                meta_sem_1 = EXCLUDED.meta_sem_1, 
                premio_sem_1 = EXCLUDED.premio_sem_1, 
                sem_1_inicio = EXCLUDED.sem_1_inicio, 
                sem_1_fim = EXCLUDED.sem_1_fim,
                meta_sem_2 = EXCLUDED.meta_sem_2, 
                premio_sem_2 = EXCLUDED.premio_sem_2, 
                sem_2_inicio = EXCLUDED.sem_2_inicio, 
                sem_2_fim = EXCLUDED.sem_2_fim,
                meta_sem_3 = EXCLUDED.meta_sem_3, 
                premio_sem_3 = EXCLUDED.premio_sem_3, 
                sem_3_inicio = EXCLUDED.sem_3_inicio, 
                sem_3_fim = EXCLUDED.sem_3_fim,
                meta_sem_4 = EXCLUDED.meta_sem_4, 
                premio_sem_4 = EXCLUDED.premio_sem_4, 
                sem_4_inicio = EXCLUDED.sem_4_inicio, 
                sem_4_fim = EXCLUDED.sem_4_fim,
                updated_at = NOW()
        `, empresaId, mes_ano, parseFloat(meta_mensal||0), premio_mensal, 
           parseFloat(meta_sem_1||0), premio_sem_1, sem_1_inicio, sem_1_fim,
           parseFloat(meta_sem_2||0), premio_sem_2, sem_2_inicio, sem_2_fim,
           parseFloat(meta_sem_3||0), premio_sem_3, sem_3_inicio, sem_3_fim,
           parseFloat(meta_sem_4||0), premio_sem_4, sem_4_inicio, sem_4_fim);

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro saveMetas:", error);
        return res.status(500).json({ error: 'Erro ao salvar configurações de metas' });
    }
};