const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
    console.log("Iniciando migração de usuários antigos para o novo sistema baseada em Funções...");

    try {
        // 1. Criar a Função Legacy (Migrado)
        console.log("1. Criando ou buscando a Função 'Acesso Migrado'...");
        // Alterado: Vamos criar a função "Administrador (Migrado)" para cada empresa individualmente
        // e conceder a permissão '["admin"]' para que não percam o acesso às páginas.

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

            // Busca ou Cria a função "Administrador" para ESTA empresa
            let funcaoId;
            const fnQuery = await prisma.$queryRawUnsafe(`SELECT id FROM painel_funcoes WHERE nome = 'Administrador (Migrado)' AND empresa_id = $1 LIMIT 1`, emp.id);
            if (fnQuery.length > 0) {
                funcaoId = fnQuery[0].id;
            } else {
                const insercaoFuncao = await prisma.$queryRawUnsafe(`
                    INSERT INTO painel_funcoes (empresa_id, nome, permissoes, ativo, criado_em)
                    VALUES ($1, 'Administrador (Migrado)', '["admin"]', true, NOW())
                    RETURNING id
                `, emp.id);
                funcaoId = insercaoFuncao[0].id;
            }

            console.log(`Migrando usuário: ${emp.email}...`);
            // Inserir ele como usuario master na sua respectiva empresa
            await prisma.$queryRawUnsafe(`
                INSERT INTO painel_usuarios (empresa_id, funcao_id, nome, email, senha_hash, session_tokens, ativo, criado_em)
                VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
            `, emp.id, funcaoId, emp.nome_fantasia || 'Usuario Master', emp.email, emp.senha, emp.session_tokens);
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
