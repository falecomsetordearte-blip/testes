// /api/auth/google-drive/status.js
// Verifica se a empresa já tem o Google Drive conectado

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { sessionToken } = req.body;
    if (!sessionToken) return res.status(400).json({ message: 'Token obrigatório.' });

    try {
        const empresas = await prisma.$queryRawUnsafe(
            `SELECT gdrive_refresh_token FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`,
            `%${sessionToken}%`
        );

        if (empresas.length === 0) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }

        const conectado = !!empresas[0].gdrive_refresh_token;
        return res.status(200).json({ conectado });

    } catch (error) {
        // Coluna pode não existir ainda — retorna false sem erro
        console.log('[GDrive Status]', error.message);
        return res.status(200).json({ conectado: false });
    }
};
