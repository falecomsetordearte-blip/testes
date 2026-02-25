const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, mes_ano, meta_mensal, meta_sem_1, premio_sem_1, meta_sem_2, premio_sem_2, meta_sem_3, premio_sem_3, meta_sem_4, premio_sem_4 } = req.body;
        
        const empresas = await prisma.$queryRawUnsafe(`SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${sessionToken}%`);
        if (empresas.length === 0) return res.status(403).json({ error: 'Auth Error' });
        const empresaId = empresas[0].id;

        await prisma.$executeRawUnsafe(`
            INSERT INTO crm_metas (empresa_id, mes_ano, meta_mensal, meta_sem_1, premio_sem_1, meta_sem_2, premio_sem_2, meta_sem_3, premio_sem_3, meta_sem_4, premio_sem_4, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (empresa_id, mes_ano) 
            DO UPDATE SET 
                meta_mensal = EXCLUDED.meta_mensal, meta_sem_1 = EXCLUDED.meta_sem_1, premio_sem_1 = EXCLUDED.premio_sem_1,
                meta_sem_2 = EXCLUDED.meta_sem_2, premio_sem_2 = EXCLUDED.premio_sem_2, meta_sem_3 = EXCLUDED.meta_sem_3, 
                premio_sem_3 = EXCLUDED.premio_sem_3, meta_sem_4 = EXCLUDED.meta_sem_4, premio_sem_4 = EXCLUDED.premio_sem_4, updated_at = NOW()
        `, empresaId, mes_ano, parseFloat(meta_mensal||0), parseFloat(meta_sem_1||0), premio_sem_1, parseFloat(meta_sem_2||0), premio_sem_2, parseFloat(meta_sem_3||0), premio_sem_3, parseFloat(meta_sem_4||0), premio_sem_4);

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao salvar metas' });
    }
};