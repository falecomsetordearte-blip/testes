// /api/getDesignerSaldo.js
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
    // Esta API espera um método GET, pois está apenas buscando dados
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = parseInt(decoded.designerId, 10);

        let financeiro = await prisma.designerFinanceiro.findUnique({
            where: { designer_id: designerId },
        });

        if (!financeiro) {
            financeiro = await prisma.designerFinanceiro.create({
                data: { designer_id: designerId }
            });
        }

        res.status(200).json({ 
            saldo_disponivel: financeiro.saldo_disponivel,
            saldo_pendente: financeiro.saldo_pendente,
            ultimo_saque_em: financeiro.ultimo_saque_em 
        });

    } catch (error) {
        console.error("Erro ao buscar saldo do designer:", error);
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token inválido ou expirado.' });
        }
        res.status(500).json({ message: 'Erro interno ao buscar saldo.' });
    }
};
