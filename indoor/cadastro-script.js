/**
 * indoor/cadastro-script.js
 * Lógica de cadastro específica para o módulo Indoor
 */

function showFeedback(containerId, message, isError = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = message;
    container.className = `form-feedback ${isError ? 'error' : 'success'}`;
    container.style.display = 'block'; 
    container.classList.remove('hidden');
}

function hideFeedback(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.classList.add('hidden');
        container.style.display = 'none';
        container.textContent = '';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const cadastroForm = document.getElementById('cadastro-form');
    if (cadastroForm) {
        cadastroForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formWrapper = document.getElementById('form-wrapper');
            const loadingFeedback = document.getElementById('loading-feedback');
            const submitButton = cadastroForm.querySelector('button[type="submit"]');
            const feedbackId = 'form-error-feedback';
            const senha = document.getElementById('senha').value;
            const confirmarSenha = document.getElementById('confirmar-senha').value;
            const aceiteTermos = document.getElementById('termos-aceite').checked;

            hideFeedback(feedbackId);
            if (!aceiteTermos) return showFeedback(feedbackId, 'Você precisa aceitar os Termos para continuar.', true);
            if (senha.length < 6) return showFeedback(feedbackId, 'Sua senha precisa ter no mínimo 6 caracteres.', true);
            if (senha !== confirmarSenha) return showFeedback(feedbackId, 'As senhas não coincidem.', true);

            submitButton.disabled = true;
            submitButton.textContent = "Processando...";

            const fileInput = document.getElementById('logo_arquivo');
            try {
                let logoUrl = null;
                if (fileInput && fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    if (file.size > 5 * 1024 * 1024) throw new Error("O logo deve ter no máximo 5MB.");
                    
                    submitButton.textContent = "Fazendo upload da logo...";
                    
                    // Import dinâmico do SDK do Vercel Blob
                    const { upload } = await import('https://esm.sh/@vercel/blob@2.3.1/client');
                    const empresaNome = document.getElementById('nome_empresa').value || 'nova_empresa';
                    const safeName = empresaNome.replace(/[^a-zA-Z0-9_-]/g, '_');
                    const fileName = `logos/${safeName}_${Date.now()}_${file.name}`;

                    const blob = await upload(fileName, file, {
                        access: 'public',
                        handleUploadUrl: '/api/upload/blob',
                        clientPayload: JSON.stringify({ isCadastro: true })
                    });
                    
                    logoUrl = blob.url;
                }

                if (formWrapper) formWrapper.classList.add('hidden');
                if (loadingFeedback) loadingFeedback.classList.remove('hidden');

                const empresaData = {
                    nomeEmpresa: document.getElementById('nome_empresa').value,
                    cnpj: document.getElementById('cnpj').value,
                    telefoneEmpresa: document.getElementById('telefone_empresa').value,
                    nomeResponsavel: document.getElementById('nome_responsavel').value,
                    email: document.getElementById('email').value,
                    senha: senha,
                    logo_url: logoUrl
                };

                const response = await fetch('/api/registerUser', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(empresaData)
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro no cadastro.');

                localStorage.setItem('sessionToken', data.token);
                localStorage.setItem('userName', data.userName);
                
                // REDIRECIONAMENTO ESPECÍFICO PARA INDOOR
                window.location.href = 'dashboard.html';

            } catch (error) {
                if (loadingFeedback) loadingFeedback.classList.add('hidden');
                if (formWrapper) formWrapper.classList.remove('hidden');
                showFeedback(feedbackId, error.message, true);
                submitButton.disabled = false;
                submitButton.textContent = "Criar Conta e Acessar";
            }
        });
    }
});
