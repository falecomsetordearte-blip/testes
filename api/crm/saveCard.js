// /api/crm/saveCard.js

const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // Configuração de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { 
            sessionToken, 
            id, 
            nome_cliente, 
            wpp_cliente, 
            servico_tipo, 
            arte_origem, 
            valor_orcamento, 
            valor_pago,      // Novo campo
            valor_restante,  // Novo campo
            briefing_json, 
            titulo_manual 
        } = req.body;

        // 1. Verificações de Segurança e Identificação da Empresa via Bitrix
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão Inválida ou expirada.' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;

        // Busca o ID da empresa local no banco Neon
        const empresas = await prisma.$queryRaw`
            SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} LIMIT 1
        `;

        if (!empresas.length) {
            return res.status(404).json({ message: `Empresa local não vinculada ao Bitrix ID ${bitrixCompanyId}` });
        }
        const empresaId = empresas[0].id;

        // 2. Gestão do Cliente (Cadastra se novo, baseando-se no telefone e empresa)
        const clienteExistente = await prisma.$queryRaw`
            SELECT id FROM crm_clientes WHERE empresa_id = ${empresaId} AND whatsapp = ${wpp_cliente} LIMIT 1
        `;
        
        if (clienteExistente.length === 0) {
            await prisma.$queryRaw`
                INSERT INTO crm_clientes (empresa_id, nome, whatsapp, created_at) 
                VALUES (${empresaId}, ${nome_cliente}, ${wpp_cliente}, NOW())
            `;
        }

        // Conversão de valores para Float (garantindo compatibilidade com DECIMAL no SQL)
        const vOrcamento = parseFloat(valor_orcamento || 0);
        const vPago = parseFloat(valor_pago || 0);
        const vRestante = parseFloat(valor_restante || 0);

        // 3. Salvar (Update) ou Criar (Insert)
        if (id) {
            // --- MODO ATUALIZAÇÃO ---
            
            // Lógica de Título: Se titulo_manual for enviado e não estiver vazio, atualiza.
            if (titulo_manual && titulo_manual.trim() !== '') {
                await prisma.$queryRaw`
                    UPDATE crm_oportunidades
                    SET nome_cliente = ${nome_cliente}, 
                        wpp_cliente = ${wpp_cliente},
                        servico_tipo = ${servico_tipo}, 
                        arte_origem = ${arte_origem},
                        valor_orcamento = ${vOrcamento}, 
                        valor_pago = ${vPago},
                        valor_restante = ${vRestante},
                        briefing_json = ${briefing_json}::jsonb,
                        titulo_automatico = ${titulo_manual}, 
                        updated_at = NOW()
                    WHERE id = ${parseInt(id)} AND empresa_id = ${empresaId}
                `;
            } else {
                // Atualização sem mexer no título atual
                await prisma.$queryRaw`
                    UPDATE crm_oportunidades
                    SET nome_cliente = ${nome_cliente}, 
                        wpp_cliente = ${wpp_cliente},
                        servico_tipo = ${servico_tipo}, 
                        arte_origem = ${arte_origem},
                        valor_orcamento = ${vOrcamento}, 
                        valor_pago = ${vPago},
                        valor_restante = ${vRestante},
                        briefing_json = ${briefing_json}::jsonb,
                        updated_at = NOW()
                    WHERE id = ${parseInt(id)} AND empresa_id = ${empresaId}
                `;
            }
            
            return res.status(200).json({ success: true, message: 'Oportunidade atualizada com sucesso.' });

        } else {
            // --- MODO CRIAÇÃO ---
            
            const novoCard = await prisma.$queryRaw`
                INSERT INTO crm_oportunidades (
                    empresa_id, nome_cliente, wpp_cliente, servico_tipo, 
                    arte_origem, valor_orcamento, valor_pago, valor_restante,
                    briefing_json, coluna, posicao, created_at
                ) VALUES (
                    ${empresaId}, ${nome_cliente}, ${wpp_cliente}, ${servico_tipo},
                    ${arte_origem}, ${vOrcamento}, ${vPago}, ${vRestante},
                    ${briefing_json}::jsonb,
                    'Novos', 0, NOW()
                )
                RETURNING id
            `;
            
            const newId = novoCard[0].id;

            // Gerar Título Final: Se não houver manual, gera o padrão "#1000 + ID"
            let tituloFinal;
            if (titulo_manual && titulo_manual.trim() !== '') {
                tituloFinal = titulo_manual;
            } else {
                tituloFinal = `#${1000 + newId}`;
            }

            // Atualiza o card recém criado com o título definitivo
            await prisma.$queryRaw`
                UPDATE crm_oportunidades 
                SET titulo_automatico = ${tituloFinal} 
                WHERE id = ${newId}
            `;
            
            return res.status(200).json({ success: true, id: newId, titulo: tituloFinal });
        }

    } catch (error) {
        console.error(`[API saveCard Error]:`, error);
        return res.status(500).json({ 
            message: 'Erro interno ao salvar oportunidade.',
            error: error.message 
        });
    }
};