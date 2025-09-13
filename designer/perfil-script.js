// /designer/perfil-script.js
(function() {
    // Função de logout e saudação compartilhada
    function setupHeader(designerName) {
        const greetingEl = document.getElementById('designer-greeting');
        const logoutButton = document.getElementById('logout-button');

        if (greetingEl) {
            greetingEl.textContent = `Olá, ${designerName}!`;
        }
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'login.html';
            });
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        // Usa o mesmo nome de token do script de login: 'designerToken'
        const sessionToken = localStorage.getItem('designerToken');
        if (!sessionToken) {
            window.location.href = 'login.html';
            return;
        }

        // Referências aos elementos do DOM
        const loadingEl = document.getElementById('loading-profile');
        const contentEl = document.getElementById('profile-content');
        const formEl = document.getElementById('profile-form');
        
        const nomeInput = document.getElementById('nome');
        const sobrenomeInput = document.getElementById('sobrenome');
        const pontuacaoDisplay = document.getElementById('pontuacao-display');
        const chavePixInput = document.getElementById('chave_pix');
        const profilePicPreview = document.getElementById('profile-pic-preview');

        try {
            // Buscar dados do perfil na nossa nova API
            const response = await fetch('/api/designer/getProfile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });

            if (!response.ok) {
                const errorData = await response.json();
                // Se o token for inválido, desloga o usuário
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'login.html';
                }
                throw new Error(errorData.message || 'Não foi possível carregar o perfil.');
            }

            const profileData = await response.json();

            // Preencher o cabeçalho com o nome vindo da API
            setupHeader(profileData.name);

            // Preencher o formulário com os dados recebidos
            nomeInput.value = profileData.name;
            sobrenomeInput.value = profileData.lastName;
            pontuacaoDisplay.textContent = profileData.pontuacao;
            chavePixInput.value = profileData.chave_pix;
            if (profileData.avatar) {
                profilePicPreview.src = profileData.avatar;
            }

            // Exibir o conteúdo e esconder o loading
            loadingEl.classList.add('hidden');
            contentEl.classList.remove('hidden');

        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
            loadingEl.innerHTML = `<p style="color: var(--erro);">${error.message}</p>`;
        }

        // A lógica para salvar as alterações será adicionada aqui no futuro
        formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('A funcionalidade de salvar alterações será implementada em breve!');
            // Futuramente, aqui virá a chamada para a API '/api/designer/updateProfile'
        });
    });
})();