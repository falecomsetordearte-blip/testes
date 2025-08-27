// /api/designer/getSaldo.js
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
    try {
        // Usa o token enviado no cabeçalho para segurança
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = decoded.designerId;

        // Procura pelo registro financeiro do designer
        let financeiro = await prisma.designerFinanceiro.findUnique({
            where: { designer_id: designerId },
        });

        // Se for o primeiro acesso do designer, cria um registro para ele
        if (!financeiro) {
            financeiro = await prisma.designerFinanceiro.create({
                data: { designer_id: designerId }
            });
        }

        res.status(200).json({ 
            saldo_disponivel: financeiro.saldo_disponivel,
            ultimo_saque_em: financeiro.ultimo_saque_em 
        });

    } catch (error) {
        console.error("Erro ao buscar saldo do designer:", error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token inválido.' });
        }
        res.status(500).json({ message: 'Erro interno ao buscar saldo.' });
    }
};
