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
        const sessionToken = uuidv4();
        const hashedPassword = await bcrypt.hash(senha, 10);
        const firstName = nomeResponsavel.split(' ')[0];

        // =================================================================
        // 3. INTEGRAÇÃO ASAAS
        // =================================================================
        try {
            if (ASAAS_API_KEY) {
                const createAsaasResponse = await axios.post(`${ASAAS_API_URL}/customers`, {
                    name: nomeEmpresa, cpfCnpj: cnpj, email: email, mobilePhone: telefoneEmpresa
                }, { headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' } });
                
                asaasCustomerId = createAsaasResponse.data.id;
                console.log(`[DEBUG] Cliente Asaas criado: ${asaasCustomerId}`);
            }
        } catch (asaasError) {
            console.error("[ASAAS ERROR]", asaasError.response?.data || asaasError.message);
        }

        // =================================================================
        // 4. SALVAR NO BANCO LOCAL (NEON)
        // =================================================================
        const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
        try {
            await client.connect();
            
            // AJUSTADO: Usando 'senha' e 'asaas_customer_id' conforme seu print do Neon
            const sql = `
                INSERT INTO empresas (
                    cnpj, nome_fantasia, whatsapp, email, responsavel, 
                    senha, session_tokens, asaas_customer_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING id;
            `;
            
            const values = [
                cnpj, nomeEmpresa, telefoneEmpresa, email, nomeResponsavel, 
                hashedPassword, sessionToken, asaasCustomerId
            ];
            
            const dbRes = await client.query(sql, values);
            const empresaLocalId = dbRes.rows[0].id;

            await client.query(`
                INSERT INTO crm_clientes (empresa_id, nome, whatsapp, created_at)
                VALUES ($1, $2, $3, NOW())
            `, [empresaLocalId, nomeResponsavel, telefoneEmpresa]);

            console.log(`[DEBUG] Cadastro finalizado! ID: ${empresaLocalId}`);

        } catch (dbError) {
            console.error("ERRO AO SALVAR NO NEON:", dbError.message);
            throw new Error(`Falha no banco: ${dbError.message}`);
        } finally {
            await client.end();
        }

        return res.status(200).json({
            success: true,
            message: "Conta criada com sucesso!",
            token: sessionToken,
            userName: firstName
        });

    } catch (error) {
        console.error('--- [ERRO FATAL NO CADASTRO] ---', error.message);
        return res.status(500).json({ message: 'Erro interno ao processar cadastro.' });
    }
};