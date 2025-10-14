// /testes/lib/prisma.js - VERSÃO CommonJS (require)

const { PrismaClient } = require('@prisma/client');

// Declara a variável global
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // Em desenvolvimento, reutilizamos a instância global para evitar múltiplas conexões
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;