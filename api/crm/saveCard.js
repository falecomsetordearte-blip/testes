// /api/crm/saveCard.js
const prisma = require('../../lib/prisma');
const axios = require('axios');

// [DEBUG] Log global para ver se o arquivo é carregado
console.log(">>> [SERVER] Arquivo api/crm/saveCard.js carregado na memória.");

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // [DEBUG] Log imediato ao receber requisição
    const requestId = Date.now();
    console.log(`\n>>> [REQ ${requestId}] Iniciando execução da função saveCard`);
    console.log(`>>> [REQ ${requestId}] Método: ${req.method}`);
    console.log(`>>> [REQ ${requestId}] Headers Content-Type: ${req.headers['content-type']}`);

    // Headers para evitar CORS e problemas de preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        console.log(`>>> [REQ ${requestId}] Respondendo OPTIONS (CORS)`);
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        console.warn(`>>> [REQ ${requestId}] Método incorreto recusado: ${req.method}`);
        return res.status(405).send('Method Not Allowed');
    }

    try {
        console.log(`>>> [REQ ${requestId}] Body recebido (início):`, JSON.stringify(req.body).substring(0, 200) + "...");

        const { sessionToken, id, nome_cliente, wpp_cliente, servico_tipo, arte_origem, valor_orcamento, briefing_json } = req.body;

        // Validando sessão Bitrix
        console.log(`>>> [REQ ${requestId}] Verificando sessão Bitrix...`);
        if (!BITRIX24_API_URL) throw new Error("Variavel de ambiente BITRIX24_API_URL não definida");

        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            console.error(`>>> [REQ ${requestId}] Sessão inválida ou usuário não encontrado.`);
            return res.status(403).json({ message: 'Inválido' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        console.log(`>>> [REQ ${requestId}] Company ID Bitrix: ${bitrixCompanyId}`);

        // Buscando empresa no Banco Local
        const empresas = await prisma.$queryRaw`SELECT id FROM empresas WHERE bitrix_id = ${bitrixCompanyId} LIMIT 1`;
        if (!empresas.length) {
            console.error(`>>> [REQ ${requestId}] Empresa não encontrada no banco local (Neon).`);
            return res.status(404).json({ message: 'Empresa local não achada' });
        }
        const empresaId = empresas[0].id;

        // Salvando/Atualizando
        if (id) {
            console.log(`>>> [REQ ${requestId}] Atualizando oportunidade ID: ${id}`);
            await prisma.$queryRaw`
                UPDATE crm_oportunidades
                SET nome_cliente = ${nome_cliente}, wpp_cliente = ${wpp_cliente},
                    servico_tipo = ${servico_tipo}, arte_origem = ${arte_origem},
                    valor_orcamento = ${parseFloat(valor_orcamento || 0)}, 
                    briefing_json = ${briefing_json},
                    updated_at = NOW()
                WHERE id = ${parseInt(id)} AND empresa_id = ${empresaId}
            `;
            console.log(`>>> [REQ ${requestId}] Atualização com sucesso.`);
            return res.status(200).json({ success: true, message: 'Atualizado' });
        } else {
            console.log(`>>> [REQ ${requestId}] Criando nova oportunidade...`);
            const novoCard = await prisma.$queryRaw`
                INSERT INTO crm_oportunidades (
                    empresa_id, nome_cliente, wpp_cliente, servico_tipo, 
                    arte_origem, valor_orcamento, briefing_json, coluna, posicao, created_at
                ) VALUES (
                    ${empresaId}, ${nome_cliente}, ${wpp_cliente}, ${servico_tipo},
                    ${arte_origem}, ${parseFloat(valor_orcamento || 0)}, ${briefing_json}, 'Novos', 0, NOW()
                )
                RETURNING id
            `;
            const newId = novoCard[0].id;
            const tituloAuto = `#OP-${1000 + newId}`;
            await prisma.$queryRaw`UPDATE crm_oportunidades SET titulo_automatico = ${tituloAuto} WHERE id = ${newId}`;
            
            console.log(`>>> [REQ ${requestId}] Criado com sucesso. ID: ${newId}`);
            return res.status(200).json({ success: true, id: newId });
        }

    } catch (error) {
        console.error(`>>> [REQ ${requestId}] ERRO FATAL:`, error);
        return res.status(500).json({ message: error.message, stack: error.stack });
    }
};