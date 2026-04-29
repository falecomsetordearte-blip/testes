const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, action, id, nome, cor } = req.body;

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

        // Ações
        if (action === 'list') {
            const segmentos = await prisma.$queryRawUnsafe(`
                SELECT * FROM marketing_segmentos WHERE empresa_id = $1 ORDER BY nome ASC
            `, empresaId);
            return res.status(200).json(segmentos);
        } 
        
        else if (action === 'create') {
            if (!nome) return res.status(400).json({ message: 'Nome do segmento é obrigatório' });
            const result = await prisma.$queryRawUnsafe(`
                INSERT INTO marketing_segmentos (empresa_id, nome, cor) 
                VALUES ($1, $2, $3) RETURNING *
            `, empresaId, nome, cor || '#3b82f6');
            return res.status(201).json(result[0]);
        } 
        
        else if (action === 'update') {
            if (!id || !nome) return res.status(400).json({ message: 'ID e Nome são obrigatórios' });
            const result = await prisma.$queryRawUnsafe(`
                UPDATE marketing_segmentos SET nome = $1, cor = $2 
                WHERE id = $3 AND empresa_id = $4 RETURNING *
            `, nome, cor || '#3b82f6', id, empresaId);
            return res.status(200).json(result[0]);
        }
        
        else if (action === 'delete') {
            if (!id) return res.status(400).json({ message: 'ID do segmento é obrigatório' });
            
            // Primeiro removemos as tags dos clientes
            await prisma.$queryRawUnsafe(`
                DELETE FROM marketing_cliente_segmentos WHERE segmento_id = $1 AND empresa_id = $2
            `, id, empresaId);

            // Depois apagamos o segmento
            await prisma.$queryRawUnsafe(`
                DELETE FROM marketing_segmentos WHERE id = $1 AND empresa_id = $2
            `, id, empresaId);
            
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ message: 'Ação inválida' });

    } catch (error) {
        console.error("Erro API Segmentos:", error);
        return res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
