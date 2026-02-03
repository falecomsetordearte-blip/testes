const prisma = require('../../lib/prisma');
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { sessionToken, id } = req.body;

        if (!id) return res.status(400).json({ message: 'ID do produto necessário' });

        // 1. Auth
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });
        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json(null);
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} LIMIT 1`;
        if (!empresas.length) return res.status(404).json(null);
        const empresaId = empresas[0].id;

        // 2. Busca Produto Completo (com Nested Relations)
        // Usamos findFirst para garantir que o produto pertence à empresaID (segurança)
        const produto = await prisma.produto.findFirst({
            where: {
                id: parseInt(id),
                empresa_id: empresaId
            },
            include: {
                variacoes: {
                    include: {
                        opcoes: true
                    }
                },
                faixas_preco: {
                    orderBy: { minimo: 'asc' }
                }
            }
        });

        if (!produto) return res.status(404).json({ message: 'Produto não encontrado' });

        return res.status(200).json(produto);

    } catch (error) {
        console.error("Erro getProduct:", error);
        return res.status(500).json({ message: 'Erro interno' });
    }
};