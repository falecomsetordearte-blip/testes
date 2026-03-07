// /api/solicitarSaqueDesigner.js

const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secreta_super_segura';

module.exports = async (req, res) => {
    // Adicionando suporte a CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-designer-info');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'Token não fornecido.' });
        
        const { valor, dataEmissao } = req.body; 
        
        if (!valor || isNaN(valor) || Number(valor) <= 0) {
            return res.status(400).json({ message: 'Valor de saque inválido.' });
        }
        if (!dataEmissao) {
            return res.status(400).json({ message: 'A Data de Emissão da NF é obrigatória.' });
        }
        
        const valorSaque = new Decimal(valor);

        // Decodifica o Token
        const decoded = jwt.verify(token, JWT_SECRET);
        const designerId = parseInt(decoded.designerId, 10);

        // Busca os dados financeiros do designer no banco Neon
        const financeiro = await prisma.designerFinanceiro.findUnique({
            where: { designer_id: designerId },
        });

        if (!financeiro || financeiro.saldo_disponivel.lt(valorSaque)) {
            return res.status(402).json({ message: 'Saldo insuficiente para este saque.' });
        }

        // 1. Atualiza os saldos no banco de dados (Neon)
        // Desconta do 'saldo_disponivel' e adiciona no 'saldo_pendente'
        await prisma.designerFinanceiro.update({
            where: { designer_id: designerId },
            data: {
                saldo_disponivel: { decrement: valorSaque },
                saldo_pendente: { increment: valorSaque },
                ultimo_saque_em: new Date(), 
            },
        });

        // 2. Salva o registro do saque na nova tabela para controle do Admin
        // Correção feita aqui: CAST($3 AS DATE) para converter o texto em data
        await prisma.$executeRawUnsafe(`
            INSERT INTO saques_designers (designer_id, valor, data_emissao_nf, status, created_at, updated_at) 
            VALUES ($1, $2, CAST($3 AS DATE), 'PENDENTE', NOW(), NOW())
        `, designerId, parseFloat(valor), dataEmissao);

        return res.status(200).json({ 
            success: true, 
            message: 'Solicitação de saque enviada com sucesso! O valor está pendente de pagamento.' 
        });

    } catch (error) {
        console.error("Erro ao solicitar saque:", error);
        
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Sessão inválida ou expirada. Faça login novamente.' });
        }
        
        return res.status(500).json({ message: 'Erro interno ao processar a solicitação de saque.' });
    }
};