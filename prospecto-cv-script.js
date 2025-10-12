// /testes/prospecto-cv-script.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-prospecto');
    const mensagemElement = document.getElementById('mensagem');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nomeInput = document.getElementById('nome');
        const whatsappInput = document.getElementById('whatsapp');
        
        const nome = nomeInput.value;
        const whatsapp = whatsappInput.value;

        mensagemElement.textContent = 'Enviando...';
        mensagemElement.style.color = 'black';

        try {
            const response = await fetch('/api/createProspecto', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nome, whatsapp }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ocorreu um erro no servidor.');
            }

            mensagemElement.textContent = `Prospecto "${nome}" cadastrado com sucesso!`;
            mensagemElement.style.color = 'green';
            form.reset(); // Limpa o formulário

        } catch (error) {
            mensagemElement.textContent = `Erro: ${error.message}`;
            mensagemElement.style.color = 'red';
        }
    });
});