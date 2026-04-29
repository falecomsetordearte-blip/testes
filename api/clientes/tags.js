const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, action, clienteId, segmentoId } = req.body;

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

        if (!clienteId || !segmentoId) {
            return res.status(400).json({ message: 'Cliente ID e Segmento ID são obrigatórios' });
        }

        if (action === 'add') {
            // Verifica se já existe
            const existe = await prisma.$queryRawUnsafe(`
                SELECT id FROM marketing_cliente_segmentos 
                WHERE cliente_id = $1 AND segmento_id = $2 AND empresa_id = $3
            `, clienteId, segmentoId, empresaId);

            if (existe.length > 0) {
                return res.status(200).json({ message: 'Tag já aplicada' });
            }

            await prisma.$queryRawUnsafe(`
                INSERT INTO marketing_cliente_segmentos (empresa_id, cliente_id, segmento_id) 
                VALUES ($1, $2, $3)
            `, empresaId, clienteId, segmentoId);

            return res.status(201).json({ success: true });
        } 
        
        else if (action === 'remove') {
            await prisma.$queryRawUnsafe(`
                DELETE FROM marketing_cliente_segmentos 
                WHERE cliente_id = $1 AND segmento_id = $2 AND empresa_id = $3
            `, clienteId, segmentoId, empresaId);

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ message: 'Ação inválida' });

    } catch (error) {
        console.error("Erro API Cliente Tags:", error);
        return res.status(500).json({ message: 'Erro interno no servidor' });
    }
};
