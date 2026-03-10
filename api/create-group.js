// Arquivo: api/create-group.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use o método POST' });
  }

  // Recebe os dados do HTML
  const { groupName, participants } = req.body;

  // LÊ AS SUAS VARIÁVEIS DE AMBIENTE DA VERCEL AQUI
  const email = process.env.CHATAPP_EMAIL;
  const password = process.env.CHATAPP_PASSWORD;
  const appId = process.env.CHATAPP_APP_ID;
  const licenseId = process.env.CHATAPP_LICENSE_ID;

  try {
    // 1. Gera o Token no ChatApp
    const tokenRequest = await fetch('https://api.chatapp.online/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, appId })
    });
    
    if (!tokenRequest.ok) throw new Error("Falha ao gerar o token do ChatApp");
    const { accessToken } = await tokenRequest.json();

    // 2. Chama a API para Criar o Grupo usando o Token
    const createGroupRequest = await fetch(`https://api.chatapp.online/v1/licenses/${licenseId}/messengers/grWhatsApp/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': accessToken
      },
      body: JSON.stringify({
        name: groupName,
        phones: participants
      })
    });

    const groupResponse = await createGroupRequest.json();

    if (!createGroupRequest.ok) {
      return res.status(400).json({ error: "Erro do ChatApp", details: groupResponse });
    }

    // Retorna para o HTML que deu tudo certo!
    return res.status(200).json({ success: true, data: groupResponse });

  } catch (error) {
    return res.status(500).json({ error: "Erro interno no servidor", details: error.message });
  }
}