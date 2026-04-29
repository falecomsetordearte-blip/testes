const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Criando tabelas de marketing...");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "marketing_clientes" (
        "id" SERIAL NOT NULL,
        "empresa_id" INTEGER NOT NULL,
        "nome" VARCHAR(255) NOT NULL,
        "whatsapp" VARCHAR(50) NOT NULL,
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "marketing_clientes_pkey" PRIMARY KEY ("id")
    );
  `);
  
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "marketing_clientes_empresa_id_whatsapp_key" ON "marketing_clientes"("empresa_id", "whatsapp");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "marketing_segmentos" (
        "id" SERIAL NOT NULL,
        "empresa_id" INTEGER NOT NULL,
        "nome" VARCHAR(100) NOT NULL,
        "cor" VARCHAR(20),
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "marketing_segmentos_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "marketing_cliente_segmentos" (
        "id" SERIAL NOT NULL,
        "empresa_id" INTEGER NOT NULL,
        "cliente_id" INTEGER NOT NULL,
        "segmento_id" INTEGER NOT NULL,
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "marketing_cliente_segmentos_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "marketing_cliente_segmentos_cliente_id_segmento_id_key" ON "marketing_cliente_segmentos"("cliente_id", "segmento_id");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "marketing_mensagens" (
        "id" SERIAL NOT NULL,
        "empresa_id" INTEGER NOT NULL,
        "ordem" INTEGER NOT NULL DEFAULT 0,
        "texto" TEXT NOT NULL,
        "delay_horas" INTEGER NOT NULL DEFAULT 0,
        "segmentos_alvo" JSONB,
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "marketing_mensagens_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "marketing_cliente_funil_log" (
        "id" SERIAL NOT NULL,
        "empresa_id" INTEGER NOT NULL,
        "cliente_id" INTEGER NOT NULL,
        "mensagem_id" INTEGER NOT NULL,
        "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "marketing_cliente_funil_log_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "marketing_cliente_funil_log_cliente_id_mensagem_id_key" ON "marketing_cliente_funil_log"("cliente_id", "mensagem_id");
  `);

  console.log("Tabelas criadas com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
