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
        
        document.getElementById('designer-greeting').textContent = `Olá, ${designerInfo.name}!`;
        document.getElementById('logout-button').addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });

        // Futuramente, aqui virá o código para carregar e salvar o perfil.
    });
})();
