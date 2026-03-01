// /designer/perfil-script.js
(function() {
    // Função para exibir feedback no formulário
    function showFeedback(containerId, message, isError = true) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.textContent = message;
        container.className = `form-feedback ${isError ? 'error' : 'success'}`;
        container.classList.remove('hidden');
    }

    // Função de logout e saudação compartilhada
    function setupHeader(designerName) {
        const greetingEl = document.getElementById('designer-greeting');
        const logoutButton = document.getElementById('logout-button');

        if (greetingEl) { greetingEl.textContent = `Olá, ${designerName}!`; }
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'login.html';
            });
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
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
        const novaSenhaInput = document.getElementById('nova_senha');
        const confirmarSenhaInput = document.getElementById('confirmar_senha');

        try {
            const response = await fetch('/api/designer/getProfile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = 'login.html';
                }
                throw new Error(errorData.message || 'Não foi possível carregar o perfil.');
            }

            const profileData = await response.json();

            setupHeader(profileData.name);
            nomeInput.value = profileData.name;
            sobrenomeInput.value = profileData.lastName;
            pontuacaoDisplay.textContent = profileData.pontuacao;
            chavePixInput.value = profileData.chave_pix;
            if (profileData.avatar) {
                profilePicPreview.src = profileData.avatar;
            }

            loadingEl.classList.add('hidden');
            contentEl.classList.remove('hidden');

        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
            loadingEl.innerHTML = `<p style="color: var(--erro);">${error.message}</p>`;
        }

        // --- LÓGICA PARA SALVAR ALTERAÇÕES ---
        formEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = formEl.querySelector('button[type="submit"]');

            // Validações de senha
            const novaSenha = novaSenhaInput.value;
            const confirmarSenha = confirmarSenhaInput.value;
            if (novaSenha && novaSenha.length < 6) {
                return showFeedback('form-feedback', 'A nova senha deve ter no mínimo 6 caracteres.');
            }
            if (novaSenha !== confirmarSenha) {
                return showFeedback('form-feedback', 'As senhas não coincidem.');
            }

            submitButton.disabled = true;
            submitButton.textContent = 'Salvando...';

            try {
                const updateData = {
                    token: sessionToken,
                    nome: nomeInput.value,
                    sobrenome: sobrenomeInput.value,
                    chave_pix: chavePixInput.value,
                    // Envia a nova senha apenas se ela foi preenchida
                    nova_senha: novaSenha || undefined
                };
                
                const response = await fetch('/api/designer/updateProfile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateData)
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message);
                }

                showFeedback('form-feedback', result.message, false); // Exibe mensagem de sucesso
                
                // Limpa os campos de senha após o sucesso
                novaSenhaInput.value = '';
                confirmarSenhaInput.value = '';

            } catch (error) {
                showFeedback('form-feedback', error.message);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Salvar Alterações';
            }
        });
    });
})();