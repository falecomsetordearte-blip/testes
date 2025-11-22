document.addEventListener('DOMContentLoaded', () => {
    const sessionToken = localStorage.getItem("sessionToken");
    
    // Verifica se está logado
    if (!sessionToken) {
        window.location.href = "/login.html";
        return;
    }

    const form = document.getElementById('profile-form');
    const feedbackDiv = document.getElementById('form-feedback');
    const btnSubmit = document.getElementById('btn-submit');

    // Aplica máscaras (opcional, mas recomendado para manter padrão)
    if (typeof IMask !== 'undefined') {
        const whatsappInput = document.getElementById('whatsapp');
        const cnpjInput = document.getElementById('cnpj');
        
        if(whatsappInput) IMask(whatsappInput, { mask: '(00) 00000-0000' });
        if(cnpjInput) IMask(cnpjInput, { mask: '00.000.000/0000-00' });
    }

    // 1. Função para Carregar Dados do Usuário
    async function loadUserProfile() {
        try {
            // Mostra loading nos campos
            document.getElementById('nome_fantasia').value = "Carregando...";

            const response = await fetch('/api/getUserData', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });

            if (!response.ok) throw new Error("Erro ao carregar dados.");

            const data = await response.json();
            
            // Preencher formulário
            document.getElementById('nome_fantasia').value = data.nome_fantasia || '';
            document.getElementById('cnpj').value = data.cnpj || '';
            document.getElementById('whatsapp').value = data.whatsapp || '';
            document.getElementById('responsavel').value = data.responsavel || '';
            document.getElementById('email').value = data.email || '';

            // Se tiver logo_id, futuramente podemos buscar a URL real.
            // Por enquanto, se tiver ID, mantemos a imagem padrão mas sabemos que existe.
            if (data.logo_id) {
                console.log("Usuário possui logo ID:", data.logo_id);
            }

        } catch (error) {
            console.error(error);
            feedbackDiv.textContent = "Não foi possível carregar seus dados. Recarregue a página.";
            feedbackDiv.className = "form-feedback error";
            feedbackDiv.classList.remove('hidden');
        }
    }

    // Executa o carregamento
    loadUserProfile();

    // 2. Função Auxiliar: Converter Imagem para Base64
    const convertBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.readAsDataURL(file);
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = (error) => reject(error);
        });
    };

    // Preview da imagem selecionada
    const fileInput = document.getElementById('new-logo-file');
    const imgPreview = document.getElementById('current-logo-img');
    
    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imgPreview.src = e.target.result;
            }
            reader.readAsDataURL(this.files[0]);
        }
    });

    // 3. Salvar Alterações
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        feedbackDiv.classList.add('hidden');
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Salvando...";

        const newPassword = document.getElementById('new_password').value;
        const confirmPassword = document.getElementById('confirm_password').value;

        // Validação de senha
        if (newPassword && newPassword !== confirmPassword) {
            feedbackDiv.textContent = "As senhas não coincidem.";
            feedbackDiv.className = "form-feedback error";
            feedbackDiv.classList.remove('hidden');
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Salvar Alterações";
            return;
        }

        // Processar Logo Nova (se houver)
        let logoData = null;
        if (fileInput.files.length > 0) {
            try {
                const file = fileInput.files[0];
                if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5MB.");
                const base64 = await convertBase64(file);
                logoData = { name: file.name, base64: base64 };
            } catch (err) {
                feedbackDiv.textContent = err.message;
                feedbackDiv.className = "form-feedback error";
                feedbackDiv.classList.remove('hidden');
                btnSubmit.disabled = false;
                return;
            }
        }

        // Montar Payload
        const payload = {
            token: sessionToken,
            nome_fantasia: document.getElementById('nome_fantasia').value,
            whatsapp: document.getElementById('whatsapp').value,
            responsavel: document.getElementById('responsavel').value,
            email: document.getElementById('email').value,
            new_password: newPassword || null,
            logo: logoData
        };

        try {
            const response = await fetch('/api/updateUserData', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.message || "Erro ao salvar.");

            // Sucesso
            feedbackDiv.textContent = "Dados atualizados com sucesso!";
            feedbackDiv.className = "form-feedback success"; // Note: Precisa ter essa classe no CSS global (verde)
            // Caso não tenha .success no style.css, ele ficará padrão ou adicione: .form-feedback.success { bg: #d4edda; color: #155724; }
            feedbackDiv.style.backgroundColor = "#d4edda"; // Fallback inline
            feedbackDiv.style.color = "#155724";
            
            feedbackDiv.classList.remove('hidden');
            
            // Limpa campos de senha
            document.getElementById('new_password').value = '';
            document.getElementById('confirm_password').value = '';
            document.getElementById('new-logo-file').value = '';

            // Atualiza nome na interface (localStorage) para refletir no header imediatamente
            if (payload.responsavel) {
                localStorage.setItem('userName', payload.responsavel.split(' ')[0]);
                // Atualiza o texto do header se o elemento existir
                const greetingEl = document.getElementById('user-greeting');
                if (greetingEl) greetingEl.textContent = `Olá, ${payload.responsavel.split(' ')[0]}!`;
            }

        } catch (error) {
            feedbackDiv.textContent = error.message;
            feedbackDiv.className = "form-feedback error";
            feedbackDiv.classList.remove('hidden');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Salvar Alterações";
        }
    });
});