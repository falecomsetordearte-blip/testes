const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, action, id, texto, delay_horas, segmentos_alvo, ordem, ativo } = req.body;

        if (!sessionToken) return res.status(401).json({ message: 'Token não fornecido' });

        // Identificar Empresa pelo Token
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
            if (empresasLegacy.length > 0) {
                empresaId = empresasLegacy[0].id;
            }
        }

        if (!empresaId) return res.status(403).json({ message: 'Sessão inválida' });

        if (action === 'list') {
            const mensagens = await prisma.$queryRawUnsafe(`
                SELECT * FROM marketing_mensagens 
                WHERE empresa_id = $1 
                ORDER BY ordem ASC, criado_em ASC
            `, empresaId);
            return res.status(200).json(mensagens);
        }

        else if (action === 'create') {
            if (!texto) return res.status(400).json({ message: 'Texto da mensagem é obrigatório' });
            
            const result = await prisma.$queryRawUnsafe(`
                INSERT INTO marketing_mensagens (empresa_id, texto, delay_horas, segmentos_alvo, ordem, ativo)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
            `, empresaId, texto, delay_horas || 0, JSON.stringify(segmentos_alvo || null), ordem || 0, ativo !== undefined ? ativo : true);
            
            return res.status(201).json(result[0]);
        }

        else if (action === 'update') {
            if (!id) return res.status(400).json({ message: 'ID da mensagem é obrigatório' });
            
            const result = await prisma.$queryRawUnsafe(`
                UPDATE marketing_mensagens 
                SET texto = $1, delay_horas = $2, segmentos_alvo = $3, ordem = $4, ativo = $5
                WHERE id = $6 AND empresa_id = $7 RETURNING *
            `, texto, delay_horas, JSON.stringify(segmentos_alvo), ordem, ativo, id, empresaId);
            
            return res.status(200).json(result[0]);
        }

        else if (action === 'delete') {
            if (!id) return res.status(400).json({ message: 'ID da mensagem é obrigatório' });
            
            await prisma.$queryRawUnsafe(`
                DELETE FROM marketing_mensagens WHERE id = $1 AND empresa_id = $2
            `, id, empresaId);
            
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ message: 'Ação inválida' });

    } catch (error) {
        console.error("Erro API Marketing Mensagens:", error);
        return res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
