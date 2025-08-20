/**
 * Bitrix24 Widget Integration
 * Script para integração do widget do Bitrix24 em todas as páginas do portal
 * Setor de Arte - app.setordearte.com.br
 */

(function() {
    'use strict';
    
    // Função para carregar o script do Bitrix24
    function loadBitrix24Widget() {
        // Verifica se o script já foi carregado para evitar duplicação
        if (document.querySelector('script[src*="bitrix24.com.br"]')) {
            return;
        }
        
        // Implementa o código original do Bitrix24
        (function(w, d, u) {
            var s = d.createElement('script');
            s.async = true;
            s.src = u + '?' + (Date.now() / 60000 | 0);
            var h = d.getElementsByTagName('script')[0];
            h.parentNode.insertBefore(s, h);
        })(window, document, 'https://cdn.bitrix24.com.br/b20224705/crm/site_button/loader_1_lvto9p.js');
    }
    
    // Carrega o widget quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadBitrix24Widget);
    } else {
        loadBitrix24Widget();
    }
    
    // Fallback para garantir que o widget seja carregado mesmo se houver problemas
    setTimeout(function() {
        if (!document.querySelector('script[src*="bitrix24.com.br"]')) {
            loadBitrix24Widget();
        }
    }, 1000);
    
})();

