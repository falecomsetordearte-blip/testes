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

    // Headers para evitar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        // Extraindo dados (Incluindo o briefing_json que estava faltando antes)
        const { sessionToken, id, nome_cliente, wpp_cliente, servico_tipo, arte_origem, valor_orcamento, briefing_json } = req.body;

        console.log(`>>> [REQ ${requestId}] Verificando sessão Bitrix...`);

        // 1. Busca o usuário no Bitrix pelo Token
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID'] 
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            console.error(`>>> [REQ ${requestId}] Sessão inválida no Bitrix.`);
            return res.status(403).json({ message: 'Sessão Inválida' });
        }
        
        // Pega o ID da EMPRESA no Bitrix (Ex: 1003)
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        console.log(`>>> [REQ ${requestId}] Bitrix Company ID: ${bitrixCompanyId}`);

        if (!bitrixCompanyId) {
            return res.status(403).json({ message: 'Usuário Bitrix sem empresa vinculada' });
        }

        // 2. Busca a empresa no Neon usando a NOVA coluna "bitrix_company_id"
        // IMPORTANTE: Certifique-se de ter preenchido manualmente essa coluna no banco com o valor '1003'
        const empresas = await prisma.$queryRaw`
            SELECT id 
            FROM empresas 
            WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} 
            LIMIT 1
        `;

        if (!empresas.length) {
            console.error(`>>> [REQ ${requestId}] ERRO: Nenhuma empresa encontrada com bitrix_company_id = ${bitrixCompanyId}`);
            return res.status(404).json({ message: `Empresa ID ${bitrixCompanyId} não encontrada no sistema local.` });
        }

        const empresaId = empresas[0].id;
        console.log(`>>> [REQ ${requestId}] Empresa Localizada no Neon! ID Interno: ${empresaId}`);

        // 3. Verifica/Cadastra o Cliente (crm_clientes)
        // Isso mantém o histórico de contatos salvos
        const clienteExistente = await prisma.$queryRaw`
            SELECT id FROM crm_clientes 
            WHERE empresa_id = ${empresaId} AND whatsapp = ${wpp_cliente}
            LIMIT 1
        `;

        if (clienteExistente.length === 0) {
            await prisma.$queryRaw`
                INSERT INTO crm_clientes (empresa_id, nome, whatsapp, created_at)
                VALUES (${empresaId}, ${nome_cliente}, ${wpp_cliente}, NOW())
            `;
            console.log(`>>> [REQ ${requestId}] Novo cliente cadastrado: ${nome_cliente}`);
        }

        // 4. Salvar ou Atualizar o Card (Oportunidade)
        if (id) {
            // ATUALIZAÇÃO
            console.log(`>>> [REQ ${requestId}] Atualizando card ID: ${id}`);
            await prisma.$queryRaw`
                UPDATE crm_oportunidades
                SET nome_cliente = ${nome_cliente}, 
                    wpp_cliente = ${wpp_cliente},
                    servico_tipo = ${servico_tipo}, 
                    arte_origem = ${arte_origem},
                    valor_orcamento = ${parseFloat(valor_orcamento || 0)}, 
                    briefing_json = ${briefing_json}, -- Salvando JSON de materiais
                    updated_at = NOW()
                WHERE id = ${parseInt(id)} AND empresa_id = ${empresaId}
            `;
            return res.status(200).json({ success: true, message: 'Atualizado com sucesso' });

        } else {
            // CRIAÇÃO
            console.log(`>>> [REQ ${requestId}] Criando novo card...`);
            const novoCard = await prisma.$queryRaw`
                INSERT INTO crm_oportunidades (
                    empresa_id, nome_cliente, wpp_cliente, servico_tipo, 
                    arte_origem, valor_orcamento, briefing_json, 
                    coluna, posicao, created_at
                ) VALUES (
                    ${empresaId}, ${nome_cliente}, ${wpp_cliente}, ${servico_tipo},
                    ${arte_origem}, ${parseFloat(valor_orcamento || 0)}, ${briefing_json}, 
                    'Novos', 0, NOW()
                )
                RETURNING id
            `;
            
            const newId = novoCard[0].id;
            // Gera titulo automático visual #OP-1001
            const tituloAuto = `#OP-${1000 + newId}`;
            await prisma.$queryRaw`UPDATE crm_oportunidades SET titulo_automatico = ${tituloAuto} WHERE id = ${newId}`;
            
            console.log(`>>> [REQ ${requestId}] Card criado com sucesso. ID: ${newId}`);
            return res.status(200).json({ success: true, id: newId });
        }

    } catch (error) {
        console.error(`>>> [REQ ${requestId}] ERRO FATAL:`, error);
        return res.status(500).json({ message: error.message || 'Erro Interno' });
    }
};