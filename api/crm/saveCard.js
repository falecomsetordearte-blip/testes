// /api/crm/saveCard.js
const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, id, nome_cliente, wpp_cliente, servico_tipo, arte_origem, valor_orcamento } = req.body;

        // 1. Auth (Padrão)
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['COMPANY_ID']
        });
        if (!userCheck.data.result || !userCheck.data.result.length) return res.status(403).json({ message: 'Inválido' });
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_id = ${bitrixCompanyId} LIMIT 1`;
        if (!empresas.length) return res.status(404).json({ message: 'Empresa local não achada' });
        const empresaId = empresas[0].id;

        // =================================================================================
        // LÓGICA DE AUTO-CADASTRO DE CLIENTE
        // Verifica se esse telefone já existe na base de clientes dessa empresa.
        // Se não existir, CRIA O CLIENTE NOVO na tabela crm_clientes.
        // =================================================================================
        const clienteExistente = await prisma.$queryRaw`
            SELECT id FROM crm_clientes 
            WHERE empresa_id = ${empresaId} AND whatsapp = ${wpp_cliente}
            LIMIT 1
        `;

        if (clienteExistente.length === 0) {
            // Cadastra o novo cliente automaticamente
            await prisma.$queryRaw`
                INSERT INTO crm_clientes (empresa_id, nome, whatsapp, created_at)
                VALUES (${empresaId}, ${nome_cliente}, ${wpp_cliente}, NOW())
            `;
            console.log(`Novo cliente ${nome_cliente} cadastrado automaticamente.`);
        } else {
            // Opcional: Atualizar o nome se mudou
            // await prisma.$queryRaw`UPDATE crm_clientes SET nome = ${nome_cliente} WHERE id = ${clienteExistente[0].id}`;
        }
        // =================================================================================

        // 2. Salvar o Card (Oportunidade) - Igual ao anterior
        if (id) {
            await prisma.$queryRaw`
                UPDATE crm_oportunidades
                SET nome_cliente = ${nome_cliente}, wpp_cliente = ${wpp_cliente},
                    servico_tipo = ${servico_tipo}, arte_origem = ${arte_origem},
                    valor_orcamento = ${parseFloat(valor_orcamento || 0)}, updated_at = NOW()
                WHERE id = ${parseInt(id)} AND empresa_id = ${empresaId}
            `;
            return res.status(200).json({ success: true, message: 'Atualizado' });
        } else {
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
            const tituloAuto = `#OP-${1000 + newId}`;
            await prisma.$queryRaw`UPDATE crm_oportunidades SET titulo_automatico = ${tituloAuto} WHERE id = ${newId}`;
            return res.status(200).json({ success: true, id: newId });
        }

    } catch (error) {
        console.error("Erro saveCard:", error);
        return res.status(500).json({ message: error.message });
    }
};