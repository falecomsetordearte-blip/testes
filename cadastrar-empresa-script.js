// testes/cadastrar-empresa-script.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-cadastro-empresa');
    const mensagemElement = document.getElementById('mensagem');

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o recarregamento da página

        // Pegar os valores dos campos do formulário
        const cnpj = document.getElementById('cnpj').value;
        const nomeFantasia = document.getElementById('nomeFantasia').value;
        const logo = document.getElementById('logo').value;
        const whatsapp = document.getElementById('whatsapp').value;
        
        // Limpar mensagens anteriores
        mensagemElement.textContent = 'Enviando...';
        mensagemElement.style.color = 'black';

        try {
            const response = await fetch('/api/empresas/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cnpj,
                    nomeFantasia,
                    logo,
                    whatsapp,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Se a resposta da API não for de sucesso, lança um erro
                throw new Error(data.message || 'Ocorreu um erro desconhecido.');
            }

            // Se tudo deu certo
            mensagemElement.textContent = `Empresa "${data.empresa.nome_fantasia}" cadastrada com sucesso!`;
            mensagemElement.style.color = 'green';
            form.reset(); // Limpa os campos do formulário

        } catch (error) {
            // Se ocorreu um erro na requisição ou na API
            mensagemElement.textContent = `Erro: ${error.message}`;
            mensagemElement.style.color = 'red';
        }
    });
});