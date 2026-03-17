const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
    console.log("Iniciando migração de usuários antigos para o novo sistema baseada em Funções...");

    try {
        // 1. Criar a Função Legacy (Migrado)
        console.log("1. Criando ou buscando a Função 'Acesso Migrado'...");
        let empresaUnicaId = 1; // Vamos precisar do ID de uma empresa pra amarrar a função e os usuários.

        // Buscar a primeira empresa como referência se houver
        const primeiraEmpresa = await prisma.$queryRawUnsafe(`SELECT id FROM empresas ORDER BY id ASC LIMIT 1`);
        if (primeiraEmpresa.length > 0) {
            empresaUnicaId = primeiraEmpresa[0].id;
        } else {
            console.log("Nenhuma empresa encontrada para parametrizar a migração. Abortando.");
            return;
        }

        let funcaoMigradaId;
        const fnMigrada = await prisma.$queryRawUnsafe(`SELECT id FROM painel_funcoes WHERE nome = 'Acesso Migrado' AND empresa_id = $1 LIMIT 1`, empresaUnicaId);
        
        if (fnMigrada.length > 0) {
            funcaoMigradaId = fnMigrada[0].id;
            console.log("Função 'Acesso Migrado' já existe. ID:", funcaoMigradaId);
        } else {
            const insercaoFuncao = await prisma.$queryRawUnsafe(`
                INSERT INTO painel_funcoes (empresa_id, nome, permissoes, ativo, criado_em)
                VALUES ($1, 'Acesso Migrado', '["acesso_total_legacy"]', true, NOW())
                RETURNING id
            `, empresaUnicaId);
            funcaoMigradaId = insercaoFuncao[0].id;
            console.log("Função 'Acesso Migrado' criada. ID:", funcaoMigradaId);
        }

        // 2. Buscar Empresários antigos que usavam login do sistema
        console.log("2. Buscando usuários base da tabela empresas...");
        const empresasLegacy = await prisma.$queryRawUnsafe(`
            SELECT id, email, senha, nome_fantasia, session_tokens 
            FROM empresas 
            WHERE email IS NOT NULL AND senha IS NOT NULL
        `);

        console.log(`Encontrados ${empresasLegacy.length} usuários para migrar.`);

        for (const emp of empresasLegacy) {
            // Verificar se usuário já existe
            const exists = await prisma.$queryRawUnsafe(`SELECT id FROM painel_usuarios WHERE email = $1 LIMIT 1`, emp.email);
            if (exists.length > 0) {
                console.log(`Usuário ${emp.email} já migrado. Pulo.`);
                continue;
            }

            console.log(`Migrando usuário: ${emp.email}...`);
            // Inserir ele como usuario "funcionário" do sistema, portando seu hash e seus tokens antigos.
            await prisma.$queryRawUnsafe(`
                INSERT INTO painel_usuarios (empresa_id, funcao_id, nome, email, senha_hash, session_tokens, ativo, criado_em)
                VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
            `, emp.id, funcaoMigradaId, emp.nome_fantasia || 'Usuario Migrado', emp.email, emp.senha, emp.session_tokens);
            console.log(`> Migrado com sucesso: ${emp.email}`);
        }

        console.log("----------");
        console.log("Migração concluída com sucesso! Os usuários já podem usar o painel pelo novo e antigo caminho simultaneamente.");

    } catch (error) {
        console.error("Erro na migração:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runMigration();
