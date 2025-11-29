// api/expedicao/entregar.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ message: 'Método inválido' });

    try {
        const { sessionToken, id } = req.body;
        if (!sessionToken || !id) return res.status(400).json({ message: 'Dados incompletos' });

        // 1. SEGURANÇA: Identificar empresa do usuário
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        // Busca ID interno
        const empresas = await prisma.$queryRawUnsafe(
            `SELECT id FROM empresas WHERE bitrix_company_id = $1 LIMIT 1`, 
            parseInt(bitrixCompanyId)
        );

        if (empresas.length === 0) return res.status(404).json({ message: 'Empresa não encontrada' });
        const empresaId = empresas[0].id;

        // 2. UPDATE SEGURO: Só atualiza se o pedido pertencer à empresa
        const resultado = await prisma.$executeRaw`
            UPDATE pedidos 
            SET status_expedicao = 'Entregue', 
                data_entrega = NOW() 
            WHERE id = ${parseInt(id)} 
            AND empresa_id = ${empresaId}
        `;

        // Se resultado for 0, significa que o ID não existe OU não pertence a essa empresa
        if (resultado === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado ou acesso negado.' });
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro Expedição Entregar:", error);
        return res.status(500).json({ message: 'Erro ao atualizar status' });
    }
};