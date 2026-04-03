// designer/perfil-script.js
(function() {
    const feedback = document.getElementById('feedback');
    const form = document.getElementById('profile-form');
    const loading = document.getElementById('loading');
    const btnSubmit = document.getElementById('btn-submit');
    const token = localStorage.getItem('designerToken');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    function showFeedback(msg, isError = true) {
        feedback.textContent = msg;
        feedback.className = `feedback ${isError ? 'error' : 'success'}`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function loadProfile() {
        try {
            const res = await fetch('/api/designer/getProfile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            document.getElementById('nome').value = data.name || '';
            document.getElementById('sobrenome').value = data.lastName || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('chave_pix').value = data.chave_pix || '';

        } catch (err) {
            showFeedback('Erro: ' + err.message);
        } finally {
            loading.classList.add('hidden');
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const senha = document.getElementById('senha').value;
        const confirmar = document.getElementById('confirmar_senha').value;

        if (senha && senha !== confirmar) {
            return showFeedback('As senhas não coincidem.');
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Salvando...';
        feedback.className = 'feedback'; // Oculta feedback anterior

        try {
            const res = await fetch('/api/designer/updateProfile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    nome: document.getElementById('nome').value,
                    sobrenome: document.getElementById('sobrenome').value,
                    email: document.getElementById('email').value,
                    chave_pix: document.getElementById('chave_pix').value,
                    nova_senha: senha || undefined
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message);

            showFeedback(result.message, false);
            document.getElementById('senha').value = '';
            document.getElementById('confirmar_senha').value = '';

        } catch (err) {
            showFeedback(err.message);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Salvar Alterações';
        }
    });

    document.getElementById('logout').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    loadProfile();
})();