// /plan.js - Sistema de Feature Gating do Setor de Arte
// Para bloquear/liberar um recurso, basta editar a lista PAID_FEATURES abaixo.

(function () {
    // ============================================================
    // CONFIGURAÇÃO CENTRAL DE PLANOS
    // Adicione a key do recurso aqui para bloqueá-lo no plano FREE
    // ============================================================
    const PAID_FEATURES = [
        'notificacoes-etapas',      // CRM: checkbox de notificação por etapa
        'mensagens-whatsapp-config', // Configurações: personalizar mensagens WhatsApp
        // Adicione mais features aqui no futuro:
        // 'relatorio-financeiro',
        // 'exportar-dados',
    ];

    // ============================================================
    // GERENCIADOR DE PLANOS
    // ============================================================
    window.PlanManager = {
        plano: localStorage.getItem('userPlano') || 'FREE',

        /** Verifica se o usuário pode usar o recurso */
        podeUsar: function (featureKey) {
            if (this.plano === 'PAID' || this.plano === 'TRIAL') return true;
            return !PAID_FEATURES.includes(featureKey);
        },

        /**
         * Bloqueia visualmente um container de feature
         * @param {string} containerId - ID do elemento wrapper da feature
         * @param {string} featureKey - Chave da feature em PAID_FEATURES
         * @param {object} opcoes - { titulo, descricao }
         */
        bloquear: function (containerId, featureKey, opcoes = {}) {
            if (this.podeUsar(featureKey)) return; // Já tem acesso, não faz nada

            const container = document.getElementById(containerId);
            if (!container) return;

            const titulo = opcoes.titulo || 'Recurso do Plano Completo';
            const descricao = opcoes.descricao || 'Assine para desbloquear este recurso.';

            // Garante posição relativa no container
            container.style.position = 'relative';
            container.style.overflow = 'hidden';

            // Desabilita todos os inputs interativos dentro
            container.querySelectorAll('input, textarea, select, button').forEach(el => {
                el.disabled = true;
                el.style.pointerEvents = 'none';
            });

            // Se for checkbox, força desmarcar
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });

            // Injeta overlay de bloqueio
            const overlayId = 'plan-lock-' + containerId;
            if (!document.getElementById(overlayId)) {
                const overlay = document.createElement('div');
                overlay.id = overlayId;
                overlay.style.cssText = `
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(248, 250, 252, 0.92);
                    backdrop-filter: blur(2px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 100; border-radius: inherit; cursor: pointer;
                    flex-direction: column; gap: 6px; text-align: center; padding: 15px;
                `;
                overlay.innerHTML = `
                    <div style="font-size: 1.3rem; color: #4f46e5;">
                        <i class="fas fa-lock"></i>
                    </div>
                    <div style="font-weight: 700; color: #1e293b; font-size: 0.9rem;">${titulo}</div>
                    <div style="color: #64748b; font-size: 0.78rem; line-height: 1.4;">${descricao}</div>
                    <button onclick="window.location.href='/assinatura.html'" style="
                        margin-top: 6px; background: #4f46e5; color: white; border: none;
                        padding: 7px 16px; border-radius: 8px; font-weight: 700;
                        cursor: pointer; font-size: 0.78rem; font-family: 'Poppins', sans-serif;
                        transition: 0.2s;
                    " onmouseover="this.style.background='#6366f1'" onmouseout="this.style.background='#4f46e5'">
                        <i class="fas fa-crown" style="margin-right:4px;"></i>Assinar e Ativar
                    </button>
                `;
                container.appendChild(overlay);
            }
        },

        /** Inicializa o plano buscando o status do servidor */
        init: async function () {
            const token = localStorage.getItem('sessionToken');
            if (!token) return;

            // Se já tem o plano em cache recente, usa o cache
            const cachedPlano = localStorage.getItem('userPlano');
            const cachedAt = parseInt(localStorage.getItem('userPlanoAt') || '0');
            const agora = Date.now();
            const CACHE_VALIDO = 5 * 60 * 1000; // 5 minutos

            if (cachedPlano && (agora - cachedAt) < CACHE_VALIDO) {
                this.plano = cachedPlano;
                this._aplicarBloqueios();
                return;
            }

            try {
                const res = await fetch('/api/auth/trial-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, type: 'EMPRESA' })
                });
                const data = await res.json();

                // Determina o plano efetivo
                const statusPagos = ['ACTIVE', 'ATIVO', 'CONFIRMED', 'PAGO', 'ASSINADO'];
                let planoEfetivo = 'FREE';

                if (statusPagos.includes((data.status_atual || '').toUpperCase())) {
                    planoEfetivo = 'PAID';
                } else if (data.is_trial && data.is_active) {
                    planoEfetivo = 'TRIAL';
                } else {
                    planoEfetivo = 'FREE';
                }

                this.plano = planoEfetivo;
                localStorage.setItem('userPlano', planoEfetivo);
                localStorage.setItem('userPlanoAt', agora.toString());

                console.log(`[PLAN] Plano atual: ${planoEfetivo}`);
                this._aplicarBloqueios();

            } catch (e) {
                console.warn('[PLAN] Erro ao verificar plano, usando cache ou FREE:', e);
                this.plano = cachedPlano || 'FREE';
                this._aplicarBloqueios();
            }
        },

        /** Hook chamado após init — páginas podem sobrescrever isso */
        _aplicarBloqueios: function () {
            // Gatilho global — cada página registra seus bloqueios via
            // window.planBloqueiosRegistrados
            if (typeof window.planBloqueiosRegistrados === 'function') {
                window.planBloqueiosRegistrados();
            }
        }
    };

    // Auto-inicializa quando o DOM estiver pronto
    document.addEventListener('DOMContentLoaded', function () {
        window.PlanManager.init();
    });
})();
