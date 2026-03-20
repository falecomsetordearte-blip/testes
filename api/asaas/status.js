// /api/asaas/status.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, tipo } = req.body; 
        if (!token || !tipo) return res.status(400).json({ message: 'Dados incompletos.' });

        let status = 'INATIVO';

        if (tipo === 'empresa') {
            const rows = await prisma.$queryRawUnsafe(`SELECT assinatura_status FROM empresas WHERE session_tokens = $1 LIMIT 1`, token);
            if (rows.length > 0) status = rows[0].assinatura_status;
        } else {
            const rows = await prisma.$queryRawUnsafe(`SELECT assinatura_status FROM designers_financeiro WHERE session_tokens = $1 LIMIT 1`, token);
            if (rows.length > 0) status = rows[0].assinatura_status;
        }

        return res.status(200).json({ status: status || 'INATIVO' });

    } catch (error) {
        return res.status(500).json({ status: 'INATIVO', error: error.message });
    }
};