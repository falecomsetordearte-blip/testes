document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-cadastro-empresa');
    const mensagemDiv = document.getElementById('mensagem');
    const btnCadastrar = document.getElementById('btn-cadastrar');

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o recarregamento da página

        // Desabilita o botão para evitar cliques duplos
        btnCadastrar.disabled = true;
        btnCadastrar.textContent = 'Cadastrando...';
        mensagemDiv.style.display = 'none';

        // Coleta os dados do formulário
        const formData = new FormData(form);
        const dados = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/empresas/cadastrar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dados),
            });

            const resultado = await response.json();

            if (!response.ok) {
                // Se a resposta não for de sucesso (ex: erro 409, 500)
                throw new Error(resultado.message || 'Ocorreu um erro.');
            }

            // Se tudo deu certo
            mensagemDiv.textContent = `Empresa "${resultado.nome_fantasia}" cadastrada com sucesso!`;
            mensagemDiv.className = 'sucesso';
            form.reset(); // Limpa o formulário

        } catch (error) {
            // Se ocorreu um erro na chamada da API
            mensagemDiv.textContent = error.message;
            mensagemDiv.className = 'erro';
        } finally {
            // Reabilita o botão e exibe a mensagem
            btnCadastrar.disabled = false;
            btnCadastrar.textContent = 'Cadastrar';
            mensagemDiv.style.display = 'block';
        }
    });
});