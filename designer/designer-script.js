// /designer/designer-script.js

// Função para exibir feedback nos formulários
function showFeedback(containerId, message, isError = true) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = message;
    container.className = `form-feedback ${isError ? 'error' : 'success'}`;
    container.classList.remove('hidden');
}

// LÓGICA DA PÁGINA DE LOGIN
const designerLoginForm = document.getElementById('designer-login-form');
if (designerLoginForm) {
    designerLoginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = designerLoginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Entrando...';

        try {
            const response = await fetch('/api/designerLogin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('email').value,
                    senha: document.getElementById('senha').value
                })
            });
            
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erro desconhecido.');
            }
            
            // Salva o token e os dados do designer no localStorage
            localStorage.setItem('designerToken', data.token);
            localStorage.setItem('designerInfo', JSON.stringify(data.designer));
            
            window.location.href = 'painel.html';

        } catch (error) {
            showFeedback('form-error-feedback', error.message);
            submitButton.disabled = false;
            submitButton.textContent = 'Entrar';
        }
    });
}

// LÓGICA DA PÁGINA DO PAINEL
if (document.querySelector('main.main-painel')) {
    const designerToken = localStorage.getItem('designerToken');
    const designerInfoString = localStorage.getItem('designerInfo');

    // Se não houver token, volta para a página de login
    if (!designerToken || !designerInfoString) {
        localStorage.clear();
        window.location.href = 'login.html';
    } else {
        const designerInfo = JSON.parse(designerInfoString);
        
        // Exibe a saudação e configura o logout
        document.getElementById('designer-greeting').textContent = `Olá, ${designerInfo.name}!`;
        document.getElementById('logout-button').addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });
        
        // Aqui adicionaremos as chamadas para buscar saldo, pedidos, etc. no futuro
    }
}
