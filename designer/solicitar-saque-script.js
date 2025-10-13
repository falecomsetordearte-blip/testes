document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-solicitar-saque');
    const feedbackEl = document.getElementById('form-feedback');
    const submitBtn = form.querySelector('button[type="submit"]');

    const designerToken = localStorage.getItem('designerToken');
    const designerInfoString = localStorage.getItem('designerInfo');

    if (!designerToken) {
        window.location.href = 'login.html';
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const valorInput = document.getElementById('valor-saque');
        const dataInput = document.getElementById('data-emissao');
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
        hideFeedback();

        try {
            const response = await fetch('/api/solicitarSaqueDesigner', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${designerToken}`,
                    'x-designer-info': designerInfoString,
                },
                body: JSON.stringify({
                    valor: Number(valorInput.value),
                    dataEmissao: dataInput.value // Enviando a data como string (YYYY-MM-DD)
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Erro desconhecido.');
            }
            
            showFeedback('Solicitação enviada com sucesso! Redirecionando...', false);
            setTimeout(() => {
                window.location.href = 'painel.html';
            }, 2000);

        } catch (error) {
            showFeedback(error.message, true);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enviar Solicitação';
        }
    });

    function showFeedback(message, isError) {
        feedbackEl.textContent = message;
        feedbackEl.className = `form-feedback ${isError ? 'error' : 'success'}`;
    }
    
    function hideFeedback() {
        feedbackEl.className = 'form-feedback hidden';
    }
});