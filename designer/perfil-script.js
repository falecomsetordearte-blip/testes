// /designer/perfil-script.js
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        const designerToken = localStorage.getItem('designerToken');
        const designerInfoString = localStorage.getItem('designerInfo');

        if (!designerToken || !designerInfoString) {
            localStorage.clear();
            window.location.href = 'login.html';
            return;
        }
        
        const designerInfo = JSON.parse(designerInfoString);
        
        // --- ELEMENTOS DO DOM ---
        const greetingEl = document.getElementById('designer-greeting');
        const logoutButton = document.getElementById('logout-button');
        const loadingEl = document.getElementById('loading-profile');
        const contentEl = document.getElementById('profile-content');
        
        const profilePicPreview = document.getElementById('profile-pic-preview');
        const nomeInput = document.getElementById('nome');
        const sobrenomeInput = document.getElementById('sobrenome');
        const pontuacaoDisplay = document.getElementById('pontuacao-display');
        const chavePixInput = document.getElementById('chave_pix');

        // --- INICIALIZAÇÃO ---
        if(greetingEl) greetingEl.textContent = `Olá, ${designerInfo.name}!`;
        if(logoutButton) logoutButton.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });

        // --- FUNÇÃO PARA CARREGAR DADOS DO PERFIL ---
        async function carregarPerfil() {
            try {
                const response = await fetch('/api/designer/getProfile', {
                    headers: { 'Authorization': `Bearer ${designerToken}` }
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                // Preenche o formulário com os dados recebidos
                if(profilePicPreview) profilePicPreview.src = data.foto || 'https://via.placeholder.com/120';
                if(nomeInput) nomeInput.value = data.nome;
                if(sobrenomeInput) sobrenomeInput.value = data.sobrenome;
                if(pontuacaoDisplay) pontuacaoDisplay.textContent = data.pontuacao;
                if(chavePixInput) chavePixInput.value = data.chave_pix;

                // Mostra o conteúdo e esconde o loading
                loadingEl.classList.add('hidden');
                contentEl.classList.remove('hidden');

            } catch (error) {
                console.error("Erro ao carregar perfil:", error);
                loadingEl.innerHTML = `<p style="color: red;">Erro ao carregar perfil: ${error.message}</p>`;
            }
        }

        // Executa a função
        carregarPerfil();

        // A lógica para salvar o formulário virá na próxima etapa
    });
})();