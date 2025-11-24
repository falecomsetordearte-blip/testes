// api/crm/saveCard.js

const prisma = require('../../lib/prisma');
const axios = require('axios');

const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    const requestId = Date.now();
    console.log(`\n>>> [SERVER] REQ ${requestId}: Iniciando saveCard`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        // Recebe 'titulo_manual' do frontend
        const { sessionToken, id, nome_cliente, wpp_cliente, servico_tipo, arte_origem, valor_orcamento, briefing_json, titulo_manual } = req.body;

        // 1. Verificações de Segurança (Bitrix e Empresa)
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, select: ['ID', 'COMPANY_ID']
        });

        if (!userCheck.data.result || !userCheck.data.result.length) {
            return res.status(403).json({ message: 'Sessão Inválida' });
        }
        
        const bitrixCompanyId = userCheck.data.result[0].COMPANY_ID;
        if (!bitrixCompanyId) return res.status(403).json({ message: 'Usuário sem empresa vinculada' });

        const empresas = await prisma.$queryRaw`
            SELECT id FROM empresas WHERE bitrix_company_id = ${parseInt(bitrixCompanyId)} LIMIT 1
        `;

        if (!empresas.length) return res.status(404).json({ message: `Empresa não encontrada.` });
        const empresaId = empresas[0].id;

        // 2. Cliente (Cadastra se novo)
        const clienteExistente = await prisma.$queryRaw`
            SELECT id FROM crm_clientes WHERE empresa_id = ${empresaId} AND whatsapp = ${wpp_cliente} LIMIT 1
        `;
        if (clienteExistente.length === 0) {
            await prisma.$queryRaw`INSERT INTO crm_clientes (empresa_id, nome, whatsapp, created_at) VALUES (${empresaId}, ${nome_cliente}, ${wpp_cliente}, NOW())`;
        }

        // 3. Salvar ou Atualizar Card
        if (id) {
            // --- ATUALIZAÇÃO ---
            console.log(`>>> [SERVER] Atualizando ID ${id}`);
            
            // Se o usuário digitou um título manual, atualizamos o campo titulo_automatico com ele.
            // Se deixou vazio, não mexemos no título (mantemos o que estava).
            if (titulo_manual && titulo_manual.trim() !== '') {
                await prisma.$queryRaw`
                    UPDATE crm_oportunidades
                    SET nome_cliente = ${nome_cliente}, 
                        wpp_cliente = ${wpp_cliente},
                        servico_tipo = ${servico_tipo}, 
                        arte_origem = ${arte_origem},
                        valor_orcamento = ${parseFloat(valor_orcamento || 0)}, 
                        briefing_json = ${briefing_json}::jsonb,
                        titulo_automatico = ${titulo_manual}, 
                        updated_at = NOW()
                    WHERE id = ${parseInt(id)} AND empresa_id = ${empresaId}
                `;
            } else {
                await prisma.$queryRaw`
                    UPDATE crm_oportunidades
                    SET nome_cliente = ${nome_cliente}, 
                        wpp_cliente = ${wpp_cliente},
                        servico_tipo = ${servico_tipo}, 
                        arte_origem = ${arte_origem},
                        valor_orcamento = ${parseFloat(valor_orcamento || 0)}, 
                        briefing_json = ${briefing_json}::jsonb,
                        updated_at = NOW()
                    WHERE id = ${parseInt(id)} AND empresa_id = ${empresaId}
                `;
            }
            return res.status(200).json({ success: true, message: 'Atualizado com sucesso' });

        } else {
            // --- CRIAÇÃO ---
            console.log(`>>> [SERVER] Criando novo card`);
            
            const novoCard = await prisma.$queryRaw`
                INSERT INTO crm_oportunidades (
                    empresa_id, nome_cliente, wpp_cliente, servico_tipo, 
                    arte_origem, valor_orcamento, briefing_json, 
                    coluna, posicao, created_at
                ) VALUES (
                    ${empresaId}, ${nome_cliente}, ${wpp_cliente}, ${servico_tipo},
                    ${arte_origem}, ${parseFloat(valor_orcamento || 0)}, 
                    ${briefing_json}::jsonb,
                    'Novos', 0, NOW()
                )
                RETURNING id
            `;
            
            const newId = novoCard[0].id;

            // Se o usuário digitou título manual, usa ele.
            // Se não, gera o automático.
            let tituloFinal;
            if (titulo_manual && titulo_manual.trim() !== '') {
                tituloFinal = titulo_manual;
            } else {
                tituloFinal = `#OP-${1000 + newId}`;
            }

            await prisma.$queryRaw`UPDATE crm_oportunidades SET titulo_automatico = ${tituloFinal} WHERE id = ${newId}`;
            
            return res.status(200).json({ success: true, id: newId });
        }

    } catch (error) {
        console.error(`>>> [SERVER] ERRO:`, error);
        return res.status(500).json({ message: error.message });
    }
};