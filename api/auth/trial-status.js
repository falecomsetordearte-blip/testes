const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    const { token, type } = req.body;

    if (!token || !type) {
        return res.status(400).json({ message: 'Token e tipo são obrigatórios.' });
    }

    try {
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
            userId = decoded.id || decoded.userId;
        } catch (e) {
            return res.status(401).json({ message: 'Sessão inválida.' });
        }

        let usuario;
        if (type === 'EMPRESA') {
            usuario = await prisma.empresa.findUnique({
                where: { id: userId },
                select: { criado_em: true, assinatura_status: true }
            });
        } else if (type === 'DESIGNER') {
            usuario = await prisma.designerFinanceiro.findUnique({
                where: { designer_id: userId },
                select: { criado_em: true, assinatura_status: true }
            });
        }

        if (!usuario) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Se já for assinante ativo, não há Trial
        if (usuario.assinatura_status === 'ACTIVE' || usuario.assinatura_status === 'CONFIRMED') {
            return res.status(200).json({ 
                is_trial: false, 
                is_active: true,
                dias_restantes: 0 
            });
        }

        // Cálculo do Trial (13 dias)
        const dataCriacao = new Date(usuario.criado_em);
        const agora = new Date();
        const diffTempo = agora - dataCriacao;
        const diffDias = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
        const diasRestantes = 13 - diffDias;

        return res.status(200).json({
            is_trial: true,
            is_active: diasRestantes > 0,
            dias_restantes: diasRestantes > 0 ? diasRestantes : 0,
            expirado: diasRestantes <= 0
        });

    } catch (error) {
        console.error('Erro trial-status:', error);
        return res.status(500).json({ message: 'Erro interno no servidor.' });
    }
};
