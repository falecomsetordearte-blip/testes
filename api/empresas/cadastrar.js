import { PrismaClient } from '@prisma/client';

const prisma = require('../lib/prisma');

export default async function handler(req, res) {
  // Apenas permitir requisições do tipo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { cnpj, nome_fantasia, logo, whatsapp } = req.body;

    // Validação básica para campos obrigatórios
    if (!cnpj || !nome_fantasia) {
      return res.status(400).json({ message: 'CNPJ e Nome Fantasia são obrigatórios.' });
    }

    // Usar o Prisma para criar a nova empresa no banco de dados
    const novaEmpresa = await prisma.empresa.create({ // <-- CORREÇÃO AQUI
      data: {
        cnpj,
        nome_fantasia,
        logo: logo ? logo.toString() : null, // Garante que o número seja salvo como texto
        whatsapp,
      },
    });

    // Retornar sucesso com os dados da empresa criada
    return res.status(201).json(novaEmpresa);

  } catch (error) {
    // Tratamento de erro específico para CNPJ duplicado
    if (error.code === 'P2002' && error.meta?.target?.includes('cnpj')) {
      return res.status(409).json({ message: 'Este CNPJ já está cadastrado.' });
    }

    // Tratamento para outros erros de banco de dados ou servidor
    console.error('Erro ao cadastrar empresa:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}