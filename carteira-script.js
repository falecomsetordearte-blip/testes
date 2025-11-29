// carteira-script.js

document.addEventListener('DOMContentLoaded', () => {
    carregarDadosCarteira();
    configurarMascaras();
    configurarFormularios();
});

// --- FUNÇÕES DE INTERFACE --- //

// Formatação Monetária
const fmtMoeda = (valor) => {
    return parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Toast Notification (Sem alertas nativos)
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '<i class="fas fa-check-circle" style="color:#2ecc71"></i>' : '<i class="fas fa-exclamation-circle" style="color:#e74c3c"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Modais
window.abrirModalRecarga = () => document.getElementById('modal-recarga').classList.add('active');
window.abrirModalAnalise = () => document.getElementById('modal-analise').classList.add('active');
window.fecharModal = (id) => document.getElementById(id).classList.remove('active');

// Máscaras (IMask)
function configurarMascaras() {
    const cnpj = document.getElementById('input-cnpj');
    if (cnpj) IMask(cnpj, { mask: '00.000.000/0000-00' });

    const valor = document.getElementById('input-valor-recarga');
    if (valor) IMask(valor, { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, normalizeZeros: true, radix: ',' });
    
    const fat = document.getElementById('input-faturamento');
    if(fat) IMask(fat, { mask: 'R$ num', blocks: { num: { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' }}});
}

// --- INTEGRAÇÃO COM API --- //

async function carregarDadosCarteira() {
    const token = localStorage.getItem('sessionToken');
    if(!token) return window.location.href = '/login.html';

    try {
        const res = await fetch('/api/carteira/dados', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: token })
        });

        if(!res.ok) throw new Error('Erro de conexão');
        const data = await res.json();

        // 1. Preencher Saldos
        document.getElementById('val-saldo').innerText = fmtMoeda(data.saldo_disponivel);
        document.getElementById('val-andamento').innerText = fmtMoeda(data.em_andamento);
        document.getElementById('val-pagar').innerText = fmtMoeda(data.a_pagar);

        // 2. Lógica de Status de Crédito
        const box = document.getElementById('credit-status-box');
        const btn = document.getElementById('btn-solicitar-credito');
        const lbl = document.getElementById('lbl-tipo-conta');
        const msg = document.getElementById('msg-credito');

        box.className = 'credit-status'; // Reset

        if (data.credito_aprovado) {
            // APROVADO
            box.classList.add('status-postpaid');
            lbl.innerText = 'Pós-paga (Crédito Aprovado)';
            msg.innerText = 'Sua linha de crédito está ativa. Faturamento mensal disponível.';
            btn.style.display = 'none';
        } else if (data.solicitacao_pendente) {
            // EM ANÁLISE
            box.classList.add('status-analyzing');
            lbl.innerText = 'Em Análise';
            msg.innerText = 'Estamos analisando seus dados. Você receberá um retorno em breve.';
            btn.innerText = 'Análise em Andamento';
            btn.disabled = true;
            btn.style.background = 'transparent';
            btn.style.color = '#c2410c';
            btn.style.border = '1px dashed #f97316';
        } else {
            // PRÉ-PAGO (PADRÃO)
            box.classList.add('status-prepaid');
            lbl.innerText = 'Pré-paga';
            msg.innerText = 'No momento, necessário pagamento antecipado para liberar produção.';
            btn.onclick = abrirModalAnalise;
        }

        // 3. Preencher Histórico
        const lista = document.getElementById('lista-historico');
        lista.innerHTML = '';
        if (data.historico_recente && data.historico_recente.length > 0) {
            data.historico_recente.forEach(item => {
                const li = document.createElement('li');
                li.style.cssText = "display:flex; justify-content:space-between; padding:15px 0; border-bottom:1px solid #f1f5f9;";
                const date = new Date(item.data).toLocaleDateString('pt-BR');
                const isPositive = item.tipo === 'ENTRADA' || (item.descricao && item.descricao.includes('Recarga'));
                const color = isPositive ? '#27ae60' : '#e74c3c';
                const signal = isPositive ? '+' : '-';
                
                li.innerHTML = `
                    <div>
                        <div style="font-weight:600; color:#2d3748;">${item.descricao || 'Movimentação'}</div>
                        <div style="font-size:0.8rem; color:#94a3b8;">${date}</div>
                    </div>
                    <div style="font-weight:700; color:${color};">${signal} ${fmtMoeda(item.valor)}</div>
                `;
                lista.appendChild(li);
            });
        } else {
            lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;">Nenhuma movimentação recente.</li>';
        }

    } catch (err) {
        console.error(err);
        showToast('Erro ao carregar dados.', 'error');
    }
}

function configurarFormularios() {
    const token = localStorage.getItem('sessionToken');

    // FORM DE RECARGA
    document.getElementById('form-recarga').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-recarga');
        const valorRaw = document.getElementById('input-valor-recarga').value;
        // Converter "1.500,00" para 1500.00
        const valorNumerico = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.'));

        if(isNaN(valorNumerico) || valorNumerico < 5) {
            return showToast('Valor mínimo de R$ 5,00', 'error');
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

        try {
            const res = await fetch('/api/addCredit', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ token, valor: valorNumerico })
            });
            const data = await res.json();

            if(res.ok && data.url) {
                window.open(data.url, '_blank');
                fecharModal('modal-recarga');
                showToast('Cobrança gerada! Aguardando pagamento.', 'success');
                // Recarregar tela após um tempo para ver se cai saldo (opcional)
            } else {
                throw new Error(data.message || 'Erro ao gerar');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-qrcode"></i> Gerar Pagamento Agora';
        }
    });

    // FORM DE ANÁLISE DE CRÉDITO
    document.getElementById('form-analise').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-submit-analise');
        
        // Coletar dados
        const formData = {
            razaoSocial: document.querySelector('[name="razaoSocial"]').value,
            cnpj: document.querySelector('[name="cnpj"]').value,
            faturamento: document.querySelector('[name="faturamento"]').value,
            tempoAtividade: document.querySelector('[name="tempoAtividade"]').value,
            contador: document.querySelector('[name="contador"]').value,
            obs: document.querySelector('[name="obs"]').value
        };

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        try {
            const res = await fetch('/api/carteira/solicitarCredito', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ sessionToken: token, formData })
            });
            
            if(res.ok) {
                fecharModal('modal-analise');
                showToast('Solicitação enviada com sucesso!', 'success');
                carregarDadosCarteira(); // Atualiza a UI para mostrar "Em Análise"
            } else {
                throw new Error('Erro ao enviar solicitação.');
            }
        } catch (err) {
            showToast('Erro ao enviar dados. Tente novamente.', 'error');
            console.error(err);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar para Análise';
        }
    });
}