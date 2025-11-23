const prisma = require('../../lib/prisma');
const axios = require('axios');

// [DEBUG] Log global
console.log(">>> [SERVER] Arquivo api/crm/saveCard.js carregado na memória.");

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    const requestId = Date.now();
    console.log(`\n>>> [REQ ${requestId}] Iniciando execução da função saveCard`);
    console.log(`>>> [REQ ${requestId}] Método: ${req.method}`);

    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { sessionToken, id, nome_cliente, wpp_cliente, servico_tipo, arte_origem, valor_orcamento, briefing_json } = req.body;

        console.log(`>>> [REQ ${requestId}] Verificando sessão Bitrix...`);

        // 1. Busca usuário Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão Inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        console.log(`>>> [REQ ${requestId}] Bitrix Company ID: ${bitrixCompanyId}`);

        if (!bitrixCompanyId) {
            return res.status(403).json({ message: 'Usuário Bitrix sem empresa vinculada' });
        }

        // 2. Busca Empresa no Neon
        const empresas = await prisma.$queryRaw`
            SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} LIMIT 1
        `;

        if (!empresas.length) {
            return res.status(404).json({ message: `Empresa ID ${bitrixCompanyId} não encontrada.` });
        }

        const empresaId = empresas[0].id;
        console.log(`>>> [REQ ${requestId}] Empresa Localizada: ID ${empresaId}`);

        // 3. Cadastra Cliente (se não existir)
        const clienteExistente = await prisma.$queryRaw`
            SELECT id FROM crm_clientes WHERE empresa_id = ${empresaId} AND whatsapp = ${wpp_cliente} LIMIT 1
        `;

        if (clienteExistente.length === 0) {
            await prisma.$queryRaw`
                INSERT INTO crm_clientes (empresa_id, nome, whatsapp, created_at)
                VALUES (${empresaId}, ${nome_cliente}, ${wpp_cliente}, NOW())
            `;
            console.log(`>>> [REQ ${requestId}] Novo cliente cadastrado.`);
        }

        // 4. Salvar/Atualizar Card (CORREÇÃO ::jsonb AQUI EMBAIXO)
        if (id) {
            console.log(`>>> [REQ ${requestId}] Atualizando card ID: ${id}`);
            await prisma.$queryRaw`
                UPDATE crm_oportunidades
                SET nome_cliente = ${nome_cliente}, 
                    wpp_cliente = ${wpp_cliente},
                    servico_tipo = ${servico_tipo}, 
                    arte_origem = ${arte_origem},
                    valor_orcamento = ${parseFloat(valor_orcamento || 0)}, 
                    briefing_json = ${briefing_json}::jsonb,  -- <--- CORREÇÃO AQUI
                    updated_at = NOW()
                WHERE id = ${parseInt(id)} AND empresa_id = ${empresaId}
            `;
            return res.status(200).json({ success: true, message: 'Atualizado com sucesso' });

        } else {
            console.log(`>>> [REQ ${requestId}] Criando novo card...`);
            const novoCard = await prisma.$queryRaw`
                INSERT INTO crm_oportunidades (
                    empresa_id, nome_cliente, wpp_cliente, servico_tipo, 
                    arte_origem, valor_orcamento, briefing_json, 
                    coluna, posicao, created_at
                ) VALUES (
                    ${empresaId}, ${nome_cliente}, ${wpp_cliente}, ${servico_tipo},
                    ${arte_origem}, ${parseFloat(valor_orcamento || 0)}, 
                    ${briefing_json}::jsonb, -- <--- CORREÇÃO AQUI
                    'Novos', 0, NOW()
                )
                RETURNING id
            `;
            
            const newId = novoCard[0].id;
            const tituloAuto = `#OP-${1000 + newId}`;
            await prisma.$queryRaw`UPDATE crm_oportunidades SET titulo_automatico = ${tituloAuto} WHERE id = ${newId}`;
            
            console.log(`>>> [REQ ${requestId}] SUCESSO! Card criado ID: ${newId}`);
            return res.status(200).json({ success: true, id: newId });
        }

    } catch (error) {
        console.error(`>>> [REQ ${requestId}] ERRO FATAL:`, error);
        return res.status(500).json({ message: error.message });
    }
};