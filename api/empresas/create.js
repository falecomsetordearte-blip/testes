// testes/api/empresas/create.js

import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  // Apenas permitir requisições do tipo POST
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Extrair os dados do corpo da requisição
    const { cnpj, nomeFantasia, logo, whatsapp } = request.body;

    // Validar se os dados obrigatórios foram enviados
    if (!cnpj || !nomeFantasia) {
      return response.status(400).json({ message: 'CNPJ e Nome Fantasia são obrigatórios.' });
    }

    // Inserir os dados na tabela 'empresas'
    const result = await sql`
      INSERT INTO empresas (cnpj, nome_fantasia, logo, whatsapp)
      VALUES (${cnpj}, ${nomeFantasia}, ${logo}, ${whatsapp})
      RETURNING *;
    `;

    // Retornar sucesso com os dados da empresa criada
    return response.status(201).json({ empresa: result.rows[0] });

  } catch (error) {
    console.error(error);
    // Tratar erro de CNPJ duplicado
    if (error.code === '23505') {
        return response.status(409).json({ message: 'Este CNPJ já está cadastrado.' });
    }
    return response.status(500).json({ message: 'Ocorreu um erro no servidor.' });
  }
}