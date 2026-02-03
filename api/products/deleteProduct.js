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

        // 1. Auth
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });
        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json({ message: 'Auth Error' });
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} LIMIT 1`;
        if (!empresas.length) return res.status(404).json({ message: 'Empresa não encontrada' });
        const empresaId = empresas[0].id;

        // 2. Deleta (Verificando se pertence à empresa)
        // O deleteMany é usado aqui como "truque" de segurança: ele só deleta se o ID E o empresa_id baterem.
        const deleteOp = await prisma.produto.deleteMany({
            where: {
                id: parseInt(id),
                empresa_id: empresaId
            }
        });

        if (deleteOp.count === 0) {
            return res.status(404).json({ message: 'Produto não encontrado ou permissão negada.' });
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Erro deleteProduct:", error);
        return res.status(500).json({ message: 'Erro ao deletar produto' });
    }
};