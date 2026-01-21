// carteira-script.js

let dadosExtratoAtual = []; 

document.addEventListener('DOMContentLoaded', () => {
    const hoje = new Date();
    const passado = new Date();
    passado.setDate(passado.getDate() - 30);
    
    const inputFim = document.getElementById('filtro-fim');
    const inputInicio = document.getElementById('filtro-inicio');
    if(inputFim) inputFim.valueAsDate = hoje;
    if(inputInicio) inputInicio.valueAsDate = passado;

    carregarDadosCarteira();
    carregarExtrato();      
    configurarMascaras();
    configurarFormularios();
});

// Helpers
const fmtMoeda = (valor) => parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

// Modais e Máscaras
window.abrirModalRecarga = () => document.getElementById('modal-recarga').classList.add('active');
window.abrirModalAnalise = () => document.getElementById('modal-analise').classList.add('active');
window.fecharModal = (id) => document.getElementById(id).classList.remove('active');

function configurarMascaras() {
    const cnpj = document.getElementById('input-cnpj');
    if (cnpj) IMask(cnpj, { mask: '00.000.000/0000-00' });
    const valor = document.getElementById('input-valor-recarga');
    if (valor) IMask(valor, { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, normalizeZeros: true, radix: ',' });
    const fat = document.getElementById('input-faturamento');
    if(fat) IMask(fat, { mask: 'R$ num', blocks: { num: { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, radix: ',' }}});
}

// APIs
async function carregarDadosCarteira() {
    const token = localStorage.getItem('sessionToken');
    if(!token) return window.location.href = '/login.html';

    try {
        const res = await fetch('/api/carteira/dados', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: token })
        });
        if(!res.ok) throw new Error('Erro');
        const data = await res.json();

        document.getElementById('val-saldo').innerText = fmtMoeda(data.saldo_disponivel);
        document.getElementById('val-andamento').innerText = fmtMoeda(data.em_andamento);
        document.getElementById('val-pagar').innerText = fmtMoeda(data.a_pagar);

        const box = document.getElementById('credit-status-box');
        const btn = document.getElementById('btn-solicitar-credito');
        const lbl = document.getElementById('lbl-tipo-conta');
        const msg = document.getElementById('msg-credito');

        box.className = 'credit-status'; 
        if (data.credito_aprovado) {
            box.classList.add('status-postpaid');
            lbl.innerText = 'Pós-paga (Crédito Aprovado)';
            msg.innerText = 'Sua linha de crédito está ativa. Faturamento mensal disponível.';
            btn.style.display = 'none';
        } else if (data.solicitacao_pendente) {
            box.classList.add('status-analyzing');
            lbl.innerText = 'Em Análise';
            msg.innerText = 'Estamos analisando seus dados.';
            btn.innerText = 'Análise em Andamento';
            btn.disabled = true;
            btn.style.cssText = 'background:transparent; color:#c2410c; border:1px dashed #f97316';
        } else {
            box.classList.add('status-prepaid');
            lbl.innerText = 'Pré-paga';
            msg.innerText = 'Necessário pagamento antecipado para liberar produção.';
            btn.onclick = abrirModalAnalise;
        }
    } catch (err) { console.error(err); }
}

window.carregarExtrato = async function() {
    const token = localStorage.getItem('sessionToken');
    const dataInicio = document.getElementById('filtro-inicio').value;
    const dataFim = document.getElementById('filtro-fim').value;
    const lista = document.getElementById('lista-historico');

    lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Buscando...</li>';

    try {
        const res = await fetch('/api/carteira/extrato', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: token, dataInicio, dataFim })
        });

        if(!res.ok) throw new Error('Erro');
        const responseData = await res.json();
        
        dadosExtratoAtual = responseData.extrato || [];
        lista.innerHTML = '';

        if (dadosExtratoAtual.length === 0) {
            lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;">Nenhum registro encontrado.</li>';
            return;
        }

        dadosExtratoAtual.forEach(item => {
            const li = document.createElement('li');
            li.style.cssText = "display: grid; grid-template-columns: 2.5fr 1fr 1fr 1fr; gap: 10px; padding: 15px 10px; border-bottom: 1px solid #f1f5f9; align-items: center;";
            
            const date = new Date(item.data).toLocaleDateString('pt-BR');
            const isSaida = item.tipo === 'SAIDA';
            const color = isSaida ? '#e74c3c' : '#27ae60';
            const signal = isSaida ? '-' : '+';
            
            let btnHtml = '<span style="color:#ccc; font-size:0.8rem; text-align:center; display:block;">-</span>';
            if (item.link_atendimento) {
                btnHtml = `
                    <a href="${item.link_atendimento}" target="_blank" class="btn-ver-atendimento btn-action-sm" style="display:block; text-align:center;">
                        <i class="fas fa-external-link-alt"></i> Ver Atend.
                    </a>`;
            }

            li.innerHTML = `
                <div style="font-weight:600; color:#2d3748; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.descricao}">
                    ${item.descricao || 'Movimentação'}
                </div>
                <div style="font-size:0.85rem; color:#64748b;">${date}</div>
                <div style="font-weight:700; color:${color}; text-align:right;">${signal} ${fmtMoeda(item.valor)}</div>
                <div>${btnHtml}</div>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error(err);
        lista.innerHTML = '<li style="text-align:center; padding:20px; color:#e74c3c;">Erro ao carregar dados.</li>';
    }
}

window.exportarCSV = function() {
    if (!dadosExtratoAtual || dadosExtratoAtual.length === 0) return showToast('Sem dados para exportar.', 'error');

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Data;Descricao;Valor;Tipo;Link Atendimento\r\n";

    dadosExtratoAtual.forEach(row => {
        const data = new Date(row.data).toLocaleDateString('pt-BR');
        const desc = (row.descricao || '').replace(/;/g, ' '); 
        const val = row.valor.toString().replace('.', ','); 
        const link = row.link_atendimento || '';
        csvContent += `${data};${desc};${val};${row.tipo};${link}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `extrato_setor_arte.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function configurarFormularios() {
    const token = localStorage.getItem('sessionToken');
    const formRecarga = document.getElementById('form-recarga');
    if (formRecarga) {
        formRecarga.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-recarga');
            const valorRaw = document.getElementById('input-valor-recarga').value;
            const valorNumerico = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.'));
            if(isNaN(valorNumerico) || valorNumerico < 5) return showToast('Mínimo R$ 5,00', 'error');

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
            try {
                const res = await fetch('/api/addCredit', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ token, valor: valorNumerico })
                });
                const data = await res.json();
                if(res.ok && data.url) {
                    window.open(data.url, '_blank');
                    fecharModal('modal-recarga');
                    showToast('Gerado!', 'success');
                } else throw new Error(data.message);
            } catch (err) { showToast(err.message, 'error'); } 
            finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-qrcode"></i> Gerar Pagamento'; }
        });
    }

    const formAnalise = document.getElementById('form-analise');
    if(formAnalise) {
        formAnalise.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-analise');
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
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ sessionToken: token, formData })
                });
                if(res.ok) {
                    fecharModal('modal-analise');
                    showToast('Enviado!', 'success');
                    carregarDadosCarteira();
                } else throw new Error('Erro');
            } catch (err) {
                showToast('Erro ao enviar.', 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar para Análise';
            }
        });
    }
}