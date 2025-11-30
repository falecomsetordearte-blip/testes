// /api/arte/moveCard.js
const prisma = require('../../lib/prisma');
const axios = require('axios');
const BITRIX24_API_URL = process.env.BITRIX24_API_URL;

module.exports = async (req, res) => {
    // LOG 1: Entrada da requisição
    console.log('--- [moveCard] Iniciando requisição ---');
    console.log('Body recebido:', req.body);

    if (req.method !== 'POST') {
        console.log('[moveCard] Erro: Método não permitido:', req.method);
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const { sessionToken, dealId, novaColuna } = req.body;

        if (!sessionToken || !dealId || !novaColuna) {
            console.log('[moveCard] Erro: Faltando parâmetros obrigatórios.');
            return res.status(400).json({ message: 'Parâmetros inválidos.' });
        }

        // 1. Auth - Verificar Usuário no Bitrix
        console.log('[moveCard] 1. Verificando token de sessão no Bitrix...');
        const userCheck = await axios.post(`${BITRIX24_API_URL}crm.contact.list.json`, {
            filter: { '%UF_CRM_1751824225': sessionToken }, 
            select: ['ID', 'NAME', 'COMPANY_ID'] // Adicionei ID e NAME para facilitar o log
        });

        // Log da resposta do Bitrix (Contatos)
        console.log('[moveCard] Resposta Bitrix (Contact List):', JSON.stringify(userCheck.data?.result));

        const user = userCheck.data.result ? userCheck.data.result[0] : null;
        
        if (!user || !user.COMPANY_ID) {
            console.log('[moveCard] Erro: Usuário não encontrado ou sem COMPANY_ID vinculado.');
            return res.status(401).json({ message: 'Sessão inválida ou usuário sem empresa.' });
        }

        console.log(`[moveCard] Usuário autenticado. Contact ID: ${user.ID}, Company Bitrix ID: ${user.COMPANY_ID}`);

        // Buscar Empresa no Banco Local
        console.log(`[moveCard] Buscando empresa local com bitrix_company_id: ${user.COMPANY_ID}`);
        const empresas = await prisma.$queryRaw`SELECT id, nome FROM empresas WHERE bitrix_company_id = ${parseInt(user.COMPANY_ID)} LIMIT 1`;
        
        console.log('[moveCard] Resultado busca empresa local:', empresas);

        if (!empresas.length) {
            console.log('[moveCard] Erro: Empresa não encontrada no banco local.');
            return res.status(403).json({ message: 'Empresa não encontrada.' });
        }
        const empresaId = empresas[0].id;
        console.log(`[moveCard] Empresa Local ID definida: ${empresaId}`);

        // 2. Verificar Deal no Bitrix
        console.log(`[moveCard] 2. Buscando detalhes do Deal ID ${dealId} no Bitrix...`);
        const dealCheck = await axios.post(`${BITRIX24_API_URL}crm.deal.get.json`, { id: dealId });
        
        const deal = dealCheck.data.result;
        
        // Log dos dados relevantes do Deal
        if (deal) {
            const tipoArte = deal['UF_CRM_1761269158'];
            console.log(`[moveCard] Dados do Deal recuperados. ID: ${deal.ID}, Tipo de Arte (UF_CRM_1761269158): '${tipoArte}'`);

            if (tipoArte === 'Setor de Arte' || tipoArte === 'Freelancer') {
                console.warn(`[moveCard] BLOQUEIO: Tentativa de mover card com tipo '${tipoArte}'.`);
                return res.status(403).json({ message: 'Pedidos com Freelancer não podem ser movidos manualmente.' });
            }
        } else {
            console.log('[moveCard] Aviso: Deal não retornado pelo Bitrix (pode não existir ou erro na API). Seguindo fluxo...');
        }

        // 3. Atualizar Banco Local
        console.log(`[moveCard] 3. Atualizando banco de dados local. Setando coluna = '${novaColuna}'...`);
        
        const updateResult = await prisma.$queryRaw`
            UPDATE painel_arte_cards 
            SET coluna = ${novaColuna}, updated_at = NOW()
            WHERE bitrix_deal_id = ${parseInt(dealId)} AND empresa_id = ${empresaId}
        `;

        // O prisma $queryRaw retorna o número de linhas afetadas em alguns drivers, ou um objeto.
        console.log('[moveCard] Resultado do Update (DB):', updateResult);

        console.log('[moveCard] Sucesso. Retornando 200.');
        return res.status(200).json({ success: true });

    } catch (error) {
        // Log detalhado de Erro
        console.error("--- [moveCard] ERRO EXCEPTION ---");
        if (error.response) {
            // Erro vindo do Axios (Bitrix)
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data));
        } else {
            // Erro geral (Prisma ou JS)
            console.error("Mensagem:", error.message);
            console.error("Stack:", error.stack);
        }
        
        return res.status(500).json({ message: 'Erro ao mover card.' });
    }
};