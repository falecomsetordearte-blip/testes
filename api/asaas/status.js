// api/asaas/status.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    try {
        const { token, tipo } = req.body; // 'empresa' ou 'designer'

        if (!token || !tipo) {
            return res.status(400).json({ message: 'Token e tipo de usuário são obrigatórios.' });
        }

        let usuario;
        
        if (tipo === 'empresa') {
            const empresas = await prisma.$queryRawUnsafe(`SELECT id, asaas_subscription_id, assinatura_status FROM empresas WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`);
            if (empresas.length > 0) usuario = empresas[0];
        } else if (tipo === 'designer') {
            const designers = await prisma.$queryRawUnsafe(`SELECT designer_id as id, asaas_subscription_id, assinatura_status FROM designers_financeiro WHERE session_tokens LIKE $1 LIMIT 1`, `%${token}%`); // O Designer usa o próprio sessionToken?
            if (designers.length > 0) usuario = designers[0];
        }

        if (!usuario) {
            return res.status(403).json({ message: 'Sessão inválida.' });
        }

        // Retorna o status atual salvo no banco de dados.
        // O webhook do Asaas é responsável por manter este campo atualizado.
        return res.status(200).json({ 
            status: usuario.assinatura_status || 'INATIVO',
            pixUrl: null, 
            pixCode: null
        });

    } catch (error) {
        console.error("Erro ao verificar status da assinatura:", error);
        return res.status(500).json({ message: 'Erro interno ao processar a verificação.' });
    }
};
