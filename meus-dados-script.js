document.addEventListener('DOMContentLoaded', () => {
    const sessionToken = localStorage.getItem("sessionToken");
    if (!sessionToken) {
        window.location.href = "login.html";
        return;
    }

    const form = document.getElementById('profile-form');
    const feedbackDiv = document.getElementById('form-feedback');
    const btnSubmit = document.getElementById('btn-submit');

    // 1. Carregar Dados do Usuário
    async function loadUserProfile() {
        try {
            // Mostra que está carregando (opcional)
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

            // Se tiver logo, tenta mostrar (precisamos pegar a URL pública do Bitrix ou um placeholder)
            // Como o Bitrix gera URLs temporárias, por enquanto vamos deixar um placeholder genérico
            // ou se você tiver a lógica de "Get Public Link" implementada, usaríamos aqui.
            // Para simplificar, se tiver ID, mostramos um ícone de check.
            if (data.logo_id) {
                const img = document.getElementById('current-logo-img');
                // Truque: Usar a API do Bitrix para pegar thumbnail se possível, ou apenas indicar que existe
                img.src = "https://setordearte.com.br/images/logo-redonda.svg"; // Placeholder indicando "Logo Configurada"
                // Se quiser ser avançado, precisaria de um endpoint '/api/getLogoUrl'
            }

        } catch (error) {
            console.error(error);
            alert("Não foi possível carregar seus dados. Tente fazer login novamente.");
        }
    }

    loadUserProfile();

    // 2. Converter Imagem para Base64
    const convertBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const fileReader = new FileReader();
            fileReader.readAsDataURL(file);
            fileReader.onload = () => resolve(fileReader.result);
            fileReader.onerror = (error) => reject(error);
        });
    };

    // 3. Salvar Alterações
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        feedbackDiv.style.display = 'none';
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Salvando...";

        const newPassword = document.getElementById('new_password').value;
        const confirmPassword = document.getElementById('confirm_password').value;

        if (newPassword && newPassword !== confirmPassword) {
            feedbackDiv.textContent = "As senhas não coincidem.";
            feedbackDiv.className = "feedback-msg error";
            feedbackDiv.style.display = 'block';
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Salvar Alterações";
            return;
        }

        // Processar Logo Nova
        const fileInput = document.getElementById('new-logo-file');
        let logoData = null;
        if (fileInput.files.length > 0) {
            try {
                const file = fileInput.files[0];
                if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5MB.");
                const base64 = await convertBase64(file);
                logoData = { name: file.name, base64: base64 };
            } catch (err) {
                alert(err.message);
                btnSubmit.disabled = false;
                return;
            }
        }

        const payload = {
            token: sessionToken,
            nome_fantasia: document.getElementById('nome_fantasia').value,
            whatsapp: document.getElementById('whatsapp').value,
            responsavel: document.getElementById('responsavel').value,
            email: document.getElementById('email').value,
            new_password: newPassword || null, // Só envia se preencheu
            logo: logoData // Só envia se selecionou
        };

        try {
            const response = await fetch('/api/updateUserData', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.message || "Erro ao salvar.");

            feedbackDiv.textContent = "Dados atualizados com sucesso!";
            feedbackDiv.className = "feedback-msg success";
            feedbackDiv.style.display = 'block';
            
            // Limpa campos de senha
            document.getElementById('new_password').value = '';
            document.getElementById('confirm_password').value = '';
            document.getElementById('new-logo-file').value = '';

            // Atualiza nome na interface se mudou
            localStorage.setItem('userName', payload.responsavel.split(' ')[0]);

        } catch (error) {
            feedbackDiv.textContent = error.message;
            feedbackDiv.className = "feedback-msg error";
            feedbackDiv.style.display = 'block';
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Salvar Alterações";
        }
    });
});