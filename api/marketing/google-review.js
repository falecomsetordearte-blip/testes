const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ message: 'Não autorizado.' });

        // Identificar empresa pelo token
        let empresaId = null;
        const usuarios = await prisma.$queryRawUnsafe(`
            SELECT empresa_id FROM painel_usuarios WHERE session_tokens LIKE $1 LIMIT 1
        `, `%${token}%`);

        if (usuarios.length > 0) {
            empresaId = usuarios[0].empresa_id;
        } else {
            const empresas = await prisma.$queryRawUnsafe(`
                SELECT id FROM empresas WHERE session_tokens LIKE $1 LIMIT 1
            `, `%${token}%`);
            if (empresas.length > 0) empresaId = empresas[0].id;
        }

        if (!empresaId) return res.status(401).json({ message: 'Sessão inválida.' });

        if (req.method === 'GET') {
            const configs = await prisma.$queryRawUnsafe(`
                SELECT google_review_link, google_review_message 
                FROM painel_configuracoes_sistema 
                WHERE empresa_id = $1
            `, empresaId);

            if (configs.length > 0) {
                return res.status(200).json({
                    google_review_link: configs[0].google_review_link || '',
                    google_review_message: configs[0].google_review_message || ''
                });
            } else {
                return res.status(200).json({ google_review_link: '', google_review_message: '' });
            }
        }

        if (req.method === 'POST') {
            const { link, message } = req.body;

            // Verifica se já existe config
            const check = await prisma.$queryRawUnsafe(`SELECT id FROM painel_configuracoes_sistema WHERE empresa_id = $1`, empresaId);

            if (check.length > 0) {
                await prisma.$executeRawUnsafe(`
                    UPDATE painel_configuracoes_sistema 
                    SET google_review_link = $1, google_review_message = $2, atualizado_em = NOW()
                    WHERE empresa_id = $3
                `, link, message, empresaId);
            } else {
                await prisma.$executeRawUnsafe(`
                    INSERT INTO painel_configuracoes_sistema (empresa_id, google_review_link, google_review_message, atualizado_em)
                    VALUES ($1, $2, $3, NOW())
                `, empresaId, link, message);
            }

            return res.status(200).json({ success: true, message: 'Configurações salvas com sucesso!' });
        }

        return res.status(405).json({ message: 'Método não permitido.' });

    } catch (error) {
        console.error('Erro em google-review:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
