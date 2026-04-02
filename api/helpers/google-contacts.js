// /api/helpers/google-contacts.js
const { google } = require('googleapis');

/**
 * Sincroniza um novo cliente com a Agenda do Google (Contacts) do Administrador.
 * Utiliza o Master Refresh Token para garantir acesso independente da empresa logada.
 */
async function syncContactToGoogle(nome, telefone) {
    // Credenciais do Google Cloud Console (ID do Projeto e Segredo)
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
    
    // Este Token deve ser gerado uma única vez pelo Administrador
    const REFRESH_TOKEN = process.env.GOOGLE_MASTER_REFRESH_TOKEN;

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        // Se as credenciais master não estiverem configuradas, apenas logamos e ignoramos silenciosamente
        console.log('[GOOGLE-CONTACTS] Sincronização ignorada: GOOGLE_MASTER_REFRESH_TOKEN não configurado.');
        return;
    }

    if (!nome || !telefone) return;

    try {
        const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
        auth.setCredentials({ refresh_token: REFRESH_TOKEN });

        const people = google.people({ version: 'v1', auth });

        // 1. Formatar Telefone (Garante que esteja no padrão internacional: Brasil 55 + DDD + Numero)
        let foneLimpo = telefone.replace(/\D/g, '');
        if (foneLimpo.length === 11 || foneLimpo.length === 10) foneLimpo = '55' + foneLimpo;
        
        console.log(`[GOOGLE-CONTACTS] Sincronizando ${nome} (${foneLimpo})...`);

        // 2. Tentar encontrar se o contato já existe pelo telefone 
        // (Isso evita duplicados se o mesmo cliente comprar em empresas diferentes)
        const searchRes = await people.people.searchContacts({
            query: foneLimpo,
            readMasks: 'names,phoneNumbers',
        }).catch(err => {
            console.warn('[GOOGLE-CONTACTS] Erro na busca (pode ser o primeiro contato):', err.message);
            return { data: { results: [] } };
        });

        if (searchRes.data.results && searchRes.data.results.length > 0) {
            console.log('[GOOGLE-CONTACTS] Contato já existe na agenda. Pulando criação.');
            return;
        }

        // 3. Criar Contato se não existir
        await people.people.createContact({
            requestBody: {
                names: [{ givenName: nome }],
                phoneNumbers: [{ value: '+' + foneLimpo, type: 'mobile' }],
                userDefined: [{ key: 'Origem', value: 'Setor de Arte Automatic' }]
            }
        });

        console.log(`[GOOGLE-CONTACTS] ✅ Sucesso: ${nome} salvo na sua agenda pessoal.`);
    } catch (error) {
        console.error('[GOOGLE-CONTACTS] ❌ Erro ao sincronizar contato:', error.message);
        if (error.response) {
            console.error('[GOOGLE-CONTACTS] Detalhes API:', JSON.stringify(error.response.data));
        }
    }
}

module.exports = { syncContactToGoogle };
