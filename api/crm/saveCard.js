// /api/crm/saveCard.js
const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, id, nome_cliente, wpp_cliente, servico_tipo, arte_origem, valor_orcamento, coluna } = req.body;

        // 1. Autenticação (Igual ao anterior)
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken },
            select: ['COMPANY_ID']
        });
        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json({ message: 'Inválido' });
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_id = ${bitrixCompanyId} LIMIT 1`;
        if (!empresas.length) return res.status(404).json({ message: 'Empresa local não achada' });
        const empresaId = empresas[0].id;

        // 2. Lógica de Salvar
        if (id) {
            // --- ATUALIZAR EXISTENTE ---
            await prisma.$queryRaw`
                UPDATE crm_oportunidades
                SET nome_cliente = ${nome_cliente},
                    wpp_cliente = ${wpp_cliente},
                    servico_tipo = ${servico_tipo},
                    arte_origem = ${arte_origem},
                    valor_orcamento = ${parseFloat(valor_orcamento || 0)},
                    updated_at = NOW()
                WHERE id = ${parseInt(id)} AND empresa_id = ${empresaId}
            `;
            return res.status(200).json({ success: true, message: 'Atualizado' });

        } else {
            // --- CRIAR NOVO ---
            // Primeiro inserimos para gerar o ID SERIAL
            const novoCard = await prisma.$queryRaw`
                INSERT INTO crm_oportunidades (
                    empresa_id, nome_cliente, wpp_cliente, servico_tipo, 
                    arte_origem, valor_orcamento, coluna, posicao, created_at
                ) VALUES (
                    ${empresaId}, ${nome_cliente}, ${wpp_cliente}, ${servico_tipo},
                    ${arte_origem}, ${parseFloat(valor_orcamento || 0)}, 'Novos', 0, NOW()
                )
                RETURNING id
            `;

            const newId = novoCard[0].id;
            
            // Atualizamos o titulo_automatico com base no ID (ex: #OP-1540)
            const tituloAuto = `#OP-${1000 + newId}`;
            await prisma.$queryRaw`UPDATE crm_oportunidades SET titulo_automatico = ${tituloAuto} WHERE id = ${newId}`;

            return res.status(200).json({ success: true, id: newId, titulo: tituloAuto });
        }

    } catch (error) {
        console.error("Erro saveCard:", error);
        return res.status(500).json({ message: error.message });
    }
};