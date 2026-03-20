// /api/registerUser.js - SEM BITRIX (Apenas Neon + Asaas)
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

// Variáveis de Ambiente
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3'; 
const DATABASE_URL = process.env.DATABASE_URL;

module.exports = async (req, res) => {
    console.log("--- [DEBUG CADASTRO EMPRESA] INICIADO ---");

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

    const { nomeEmpresa, cnpj, telefoneEmpresa, nomeResponsavel, email, senha } = req.body;

    if (!nomeEmpresa || !email || !senha || !cnpj || !nomeResponsavel) {
        return res.status(400).json({ message: 'Preencha todos os campos obrigatórios.' });
    }

    // =================================================================
    // 1. VALIDAÇÃO DE DUPLICIDADE NO BANCO (NEON)
    // =================================================================
    console.log("[DEBUG] Verificando duplicidade no banco...");
    const checkClient = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await checkClient.connect();
        const checkResult = await checkClient.query(
            `SELECT email, cnpj, whatsapp FROM empresas WHERE email = $1 OR cnpj = $2 OR whatsapp = $3 LIMIT 1`, 
            [email, cnpj, telefoneEmpresa]
        );

        if (checkResult.rows.length > 0) {
            const existing = checkResult.rows[0];
            let msg = "Dados já cadastrados.";
            if (existing.email === email) msg = "Este e-mail já possui cadastro.";
            else if (existing.cnpj === cnpj) msg = "Este CNPJ já está cadastrado.";
            else if (existing.whatsapp === telefoneEmpresa) msg = "Este WhatsApp já está em uso.";
            
            await checkClient.end();
            return res.status(409).json({ message: msg });
        }
    } catch (dbError) {
        await checkClient.end();
        console.error("[NEON DB CHECK ERROR]", dbError.message);
        return res.status(500).json({ message: "Erro de conexão ao validar dados." });
    }
    await checkClient.end();

    let asaasCustomerId = null;

    try {
        // 2. Preparar Senha e Token (Agora ficam no Neon)
        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);
        
        const nameParts = nomeResponsavel.split(' ');
        const firstName = nameParts.shift();

        // =================================================================
        // 3. INTEGRAÇÃO ASAAS (ISOLADA)
        // =================================================================
        console.log("[DEBUG] Tentando criar cliente no Asaas...");
        try {
            if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada.");

            const createAsaasResponse = await axios.post(`${ASAAS_API_URL}/customers`, {
                name: nomeEmpresa, 
                cpfCnpj: cnpj, 
                email: email, 
                mobilePhone: telefoneEmpresa
            }, { 
                headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' } 
            });
            
            asaasCustomerId = createAsaasResponse.data.id;
            console.log(`[DEBUG] Cliente Asaas criado com sucesso: ${asaasCustomerId}`);

        } catch (asaasError) {
            console.error("--- [ATENÇÃO: FALHA NO ASAAS] ---");
            console.error("Status:", asaasError.response?.status);
            console.error("Detalhes:", JSON.stringify(asaasError.response?.data || asaasError.message));
            console.error("O cadastro local continuará mesmo sem o Asaas.");
            asaasCustomerId = null; 
        }

        // =================================================================
        // 4. SALVAR NO BANCO LOCAL (NEON)
        // =================================================================
        console.log("[DEBUG] Salvando dados e senha no Banco Local (Neon)...");
        const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
        try {
            await client.connect();
            
            // Salvando tudo direto na tabela 'empresas'
            const sql = `
                INSERT INTO empresas (
                    cnpj, nome_fantasia, whatsapp, email, responsavel, 
                    senha_hash, session_tokens, asaas_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING id;
            `;
            
            const values = [
                cnpj, nomeEmpresa, telefoneEmpresa, email, nomeResponsavel, 
                hashedPassword, sessionToken, asaasCustomerId
            ];
            
            const dbRes = await client.query(sql, values);
            const empresaLocalId = dbRes.rows[0].id;

            // Cria o registro na tabela crm_clientes para ele aparecer nas buscas do CRM
            await client.query(`
                INSERT INTO crm_clientes (empresa_id, nome, whatsapp, created_at)
                VALUES ($1, $2, $3, NOW())
            `, [empresaLocalId, nomeResponsavel, telefoneEmpresa]);

            console.log(`[DEBUG] Cadastro 100% finalizado! ID Local: ${empresaLocalId}`);

        } catch (dbError) {
            console.error("ERRO CRÍTICO AO SALVAR NO NEON:", dbError.message);
            throw new Error(`Falha no banco: ${dbError.message}`);
        } finally {
            await client.end();
        }

        // 5. Retorna sucesso para o Front-End
        return res.status(200).json({
            success: true,
            message: "Conta criada com sucesso!",
            token: sessionToken,
            userName: firstName
        });

    } catch (error) {
        console.error('--- [ERRO FATAL NO CADASTRO] ---', error.message);
        return res.status(500).json({ message: 'Erro ao processar cadastro no servidor. Tente novamente.' });
    }
};