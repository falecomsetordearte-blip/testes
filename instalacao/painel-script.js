// /instalacao/painel-script.js - VERSÃO COM CALENDÁRIO

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }
        
        // --- CONSTANTES ---
        const LAYOUT_FIELD = 'UF_CRM_1764124589418';
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const LINK_ATENDIMENTO_FIELD = 'UF_CRM_1752712769666';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const LINK_ARQUIVO_FINAL_FIELD = 'UF_CRM_1748277308731';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';
        
        const MEDIDAS_MAP = {
            '1437': { nome: 'Conferir', cor: '#e74c3c' },
            '1439': { nome: 'Cliente', cor: '#f1c40f' },
            '1441': { nome: 'Conferida', cor: '#2ecc71' }
        };

        // Elementos DOM Principais
        const boardKanban = document.getElementById('view-kanban');
        const boardCalendar = document.getElementById('view-calendar');
        const btnViewKanban = document.getElementById('btn-view-kanban');
        const btnViewCalendar = document.getElementById('btn-view-calendar');

        // Modais
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        const modalAgendamento = document.getElementById('modal-agendamento');
        const inputInstaladores = document.getElementById('input-instaladores');
        const inputDuracao = document.getElementById('input-duracao');
        const btnSalvarAgendamento = document.getElementById('btn-salvar-agendamento');
        let currentEditingDealId = null;

        let allDealsData = [];
        let allSchedules = []; // Dados do DB Neon
        
        // Configurações do Calendário
        const CALENDAR_START_HOUR = 8;
        const CALENDAR_END_HOUR = 18;
        const PIXELS_PER_HOUR = 100; // Altura de 1 hora na tela

        // --- CSS NOVO E ATUALIZADO ---
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --primary: #3498db; 
                --success: #2ecc71;
                --danger: #e74c3c;
                --text-dark: #2c3e50;
                --bg-card: #ffffff;
                --grid-line: #eee;
            }

            /* Header e Botões de View */
            .kanban-header { display: flex; justify-content: space-between; align-items: center; padding: 0 20px; margin-bottom: 20px; }
            .view-switcher { display: flex; gap: 10px; background: #fff; padding: 5px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .view-switcher button { border: none; background: transparent; padding: 8px 15px; cursor: pointer; border-radius: 6px; font-weight: 600; color: #7f8c8d; transition: all 0.2s; }
            .view-switcher button.active { background: var(--primary); color: white; }
            .hidden { display: none !important; }

            /* Estilos Kanban Original */
            .kanban-board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; align-items: flex-start; }
            .kanban-column { background: transparent; min-width: 280px; max-width: 320px; display: flex; flex-direction: column; max-height: 80vh; }
            .column-header { font-weight: 700; color: white; margin-bottom: 15px; text-transform: uppercase; font-size: 0.9rem; padding: 10px 15px; border-radius: 6px; text-align: center; }
            .status-atrasado .column-header { background-color: var(--danger); }
            .status-hoje .column-header { background-color: #f1c40f; color: #333; }
            .status-esta-semana .column-header { background-color: #2980b9; }
            .status-proxima-semana .column-header { background-color: #8e44ad; }
            .status-sem-data .column-header { background-color: #95a5a6; }
            .column-cards { overflow-y: auto; flex-grow: 1; min-height: 100px; padding-right: 5px; }

            .kanban-card { background: var(--bg-card); border-radius: 8px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 5px solid var(--primary); cursor: pointer; position: relative; transition: transform 0.2s; }
            .kanban-card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            .card-id { font-size: 0.75rem; color: #aaa; font-weight: 600; }
            .card-client-name { font-size: 1rem; font-weight: 600; color: var(--text-dark); margin-bottom: 5px; }
            .btn-detalhes-visual { width: 100%; background: #f4f6f9; border: 1px solid #e1e1e1; padding: 5px; border-radius: 4px; text-align: center; font-size: 0.8rem; margin-top: 10px; }

            /* --- CALENDÁRIO --- */
            .calendar-container { display: flex; height: calc(100vh - 120px); gap: 20px; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.05); border: 1px solid #ddd; }
            
            /* Sidebar do Calendário (Backlog) */
            .calendar-sidebar { width: 250px; background: #f9f9f9; padding: 15px; border-right: 1px solid #eee; display: flex; flex-direction: column; }
            .calendar-sidebar h3 { font-size: 1rem; margin: 0 0 5px 0; color: var(--text-dark); }
            .calendar-sidebar .hint { font-size: 0.8rem; color: #999; margin-bottom: 15px; }
            .backlog-list { flex-grow: 1; overflow-y: auto; padding-right: 5px; }
            .backlog-card { background: white; padding: 10px; margin-bottom: 10px; border-radius: 6px; border: 1px solid #ddd; cursor: grab; font-size: 0.9rem; }
            .backlog-card:active { cursor: grabbing; }

            /* Grid Principal */
            .calendar-main { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
            
            .calendar-header-dates { display: grid; grid-template-columns: 60px repeat(5, 1fr); background: #f4f6f9; border-bottom: 1px solid #ddd; height: 50px; }
            .cal-header-cell { display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--text-dark); border-right: 1px solid #ddd; flex-direction: column; line-height: 1.2; font-size: 0.9rem; }
            .cal-header-cell.today { background-color: #e3f2fd; color: var(--primary); }
            
            .calendar-grid-body { display: flex; flex-grow: 1; overflow-y: auto; position: relative; }
            
            /* Coluna de Horas */
            .time-labels { width: 60px; flex-shrink: 0; background: #fff; border-right: 1px solid #ddd; }
            .time-labels div { height: ${PIXELS_PER_HOUR}px; border-bottom: 1px solid transparent; font-size: 0.75rem; color: #999; text-align: right; padding-right: 8px; transform: translateY(-50%); padding-top: 5px; }

            /* Colunas dos Dias */
            .day-columns-wrapper { display: grid; grid-template-columns: repeat(5, 1fr); flex-grow: 1; position: relative; background: repeating-linear-gradient(to bottom, transparent 0, transparent ${PIXELS_PER_HOUR - 1}px, #f0f0f0 ${PIXELS_PER_HOUR}px); background-size: 100% ${PIXELS_PER_HOUR}px; }
            
            .day-column { border-right: 1px solid #eee; position: relative; height: ${(CALENDAR_END_HOUR - CALENDAR_START_HOUR) * PIXELS_PER_HOUR}px; }
            .day-column.droppable-hover { background-color: rgba(52, 152, 219, 0.1); }

            /* Cards no Calendário */
            .calendar-event { 
                position: absolute; width: 94%; left: 3%; 
                background: #e3f2fd; border-left: 4px solid var(--primary); 
                border-radius: 4px; padding: 5px; font-size: 0.8rem; 
                overflow: hidden; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex; flex-direction: column; z-index: 10;
            }
            .calendar-event:hover { z-index: 20; box-shadow: 0 5px 10px rgba(0,0,0,0.2); }
            .event-time { font-weight: 700; color: var(--primary); font-size: 0.7rem; margin-bottom: 2px; }
            .event-title { font-weight: 600; color: #333; line-height: 1.2; }
            .event-tags { margin-top: auto; padding-top: 4px; display: flex; gap: 4px; flex-wrap: wrap; }
            .tag-installer { background: #333; color: white; border-radius: 3px; padding: 1px 4px; font-size: 0.65rem; }
            .btn-edit-event { position: absolute; top: 2px; right: 2px; border: none; background: none; color: #999; cursor: pointer; font-size: 0.8rem; }
            .btn-edit-event:hover { color: var(--primary); }

            /* Agulha Vermelha */
            .current-time-line { position: absolute; width: 100%; border-top: 2px solid red; z-index: 50; pointer-events: none; }
            .current-time-circle { width: 10px; height: 10px; background: red; border-radius: 50%; position: absolute; left: -5px; top: -6px; }

            /* Classes Gerais */
            .toast-container { position: fixed; top: 20px; right: 20px; z-index: 10000; }
            .toast { background: white; padding: 15px; margin-bottom: 10px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); border-left: 5px solid #ccc; display: flex; align-items: center; gap: 10px; animation: slideIn 0.3s; }
            .toast.success { border-left-color: var(--success); }
            .toast.error { border-left-color: var(--danger); }
            @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            
            /* Modal Styles (Simplificado) */
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 9999; }
            .modal-overlay.active { display: flex; }
            .modal-content { background: white; width: 90%; max-width: 500px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden; }
            .modal-header { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; }
            .modal-body { padding: 20px; }
            .close-modal { background: none; border: none; font-size: 1.5rem; cursor: pointer; }
            
            /* Loading */
            .spinner { width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);

        const toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);

        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `<div>${message}</div>`;
            toastContainer.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }

        // --- LÓGICA DE DADOS ---
        async function loadAllData() {
            try {
                // 1. Carrega Pedidos do Bitrix
                const resDeals = await fetch('/api/instalacao/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken })
                });
                const dataDeals = await resDeals.json();
                allDealsData = dataDeals.deals || [];

                // 2. Carrega Agendamentos do Neon
                const resSchedule = await fetch('/api/instalacao/getSchedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}) // Sem token por enquanto na leitura, ou adicione se precisar
                });
                const dataSchedule = await resSchedule.json();
                allSchedules = dataSchedule.schedules || [];

                renderKanban();
                renderCalendar();

            } catch (error) {
                console.error(error);
                showToast("Erro ao carregar dados", "error");
            }
        }

        function getScheduleForDeal(dealId) {
            return allSchedules.find(s => s.bitrix_deal_id == dealId);
        }

        // --- RENDERIZAR KANBAN (Simplificado para focar na integração) ---
        function renderKanban() {
            document.querySelectorAll('.column-cards').forEach(c => c.innerHTML = '');
            
            allDealsData.forEach(deal => {
                let colunaId = 'SEM_DATA';
                // Lógica de coluna baseada na data do Bitrix
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                if (prazoFinalStr) {
                    const prazoData = new Date(prazoFinalStr.split('T')[0]);
                    const hoje = new Date(); hoje.setHours(0,0,0,0);
                    const diffDays = Math.ceil((prazoData - hoje) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else colunaId = 'PROXIMA_SEMANA';
                }

                const card = document.createElement('div');
                card.className = 'kanban-card';
                card.dataset.dealId = deal.ID;
                card.innerHTML = `
                    <div class="card-id">#${deal.TITLE || deal.ID}</div>
                    <div class="card-client-name">${deal[NOME_CLIENTE_FIELD] || 'Cliente não inf.'}</div>
                    <button class="btn-detalhes-visual"><i class="fa fa-eye"></i> Visualizar</button>
                `;
                card.querySelector('.btn-detalhes-visual').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openDetailsModal(deal.ID);
                });

                const col = document.getElementById(`cards-${colunaId}`);
                if (col) col.appendChild(card);
            });
        }

        // --- RENDERIZAR CALENDÁRIO ---
        function renderCalendar() {
            const backlogContainer = document.getElementById('calendar-backlog');
            const columnsContainer = document.getElementById('calendar-columns-container');
            const headerRow = document.getElementById('calendar-header-row');
            
            backlogContainer.innerHTML = '';
            columnsContainer.innerHTML = '';
            headerRow.innerHTML = '<div class="cal-header-cell"></div>'; // Célula vazia para coluna de horas

            // 1. Configurar Datas da Semana Atual (Segunda a Sexta)
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 (Dom) a 6 (Sab)
            const distToMonday = (dayOfWeek + 6) % 7; // Quanto falta voltar pra segunda
            const monday = new Date(today);
            monday.setDate(today.getDate() - distToMonday);

            const weekDays = [];
            for(let i=0; i<5; i++) {
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                weekDays.push(d);
            }

            // 2. Renderizar Cabeçalho e Colunas
            weekDays.forEach((date, index) => {
                const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
                const isToday = date.toDateString() === today.toDateString();
                
                // Header
                const headerCell = document.createElement('div');
                headerCell.className = `cal-header-cell ${isToday ? 'today' : ''}`;
                headerCell.innerHTML = `<span>${dateStr.split(',')[0]}</span><span style="font-size:0.8em">${dateStr.split(',')[1]}</span>`;
                headerRow.appendChild(headerCell);

                // Coluna do Dia
                const col = document.createElement('div');
                col.className = 'day-column';
                col.dataset.dateIso = date.toISOString().split('T')[0]; // YYYY-MM-DD
                col.addEventListener('dragover', handleDragOver);
                col.addEventListener('dragleave', handleDragLeave);
                col.addEventListener('drop', handleDropOnCalendar);

                // Agulha vermelha (Se for hoje)
                if (isToday) {
                    addRedNeedle(col);
                }

                columnsContainer.appendChild(col);
            });

            // 3. Preencher Eventos e Backlog
            allDealsData.forEach(deal => {
                const schedule = getScheduleForDeal(deal.ID);

                // Se tem agendamento e está dentro da semana visualizada
                if (schedule && schedule.start_time) {
                    const start = new Date(schedule.start_time);
                    const end = new Date(schedule.end_time);
                    
                    // Verifica se a data do evento cai em um dos dias da semana renderizada
                    const dayCol = Array.from(document.querySelectorAll('.day-column')).find(c => c.dataset.dateIso === start.toISOString().split('T')[0]);

                    if (dayCol) {
                        createCalendarEvent(deal, schedule, dayCol);
                    } else {
                        // Agendado para outra semana? Por enquanto vai pro backlog ou não mostramos?
                        // Vamos colocar no backlog com um aviso se quiser
                        createBacklogCard(deal, backlogContainer, true); 
                    }
                } else {
                    // Sem agendamento -> Backlog
                    createBacklogCard(deal, backlogContainer);
                }
            });
        }

        function createBacklogCard(deal, container, isScheduledOtherWeek = false) {
            const el = document.createElement('div');
            el.className = 'backlog-card';
            el.draggable = true;
            el.dataset.dealId = deal.ID;
            el.innerHTML = `
                <div style="font-weight:600">#${deal.TITLE || deal.ID}</div>
                <div style="font-size:0.8rem">${deal[NOME_CLIENTE_FIELD] || 'Cliente'}</div>
                ${isScheduledOtherWeek ? '<div style="color:orange; font-size:0.7rem">Agendado outra semana</div>' : ''}
            `;
            el.addEventListener('dragstart', handleDragStart);
            container.appendChild(el);
        }

        function createCalendarEvent(deal, schedule, parentColumn) {
            const start = new Date(schedule.start_time);
            const end = new Date(schedule.end_time);

            // Calcular posição Y e Altura
            const startHour = start.getHours() + (start.getMinutes() / 60);
            const endHour = end.getHours() + (end.getMinutes() / 60);
            
            const duration = endHour - startHour;
            const topPixels = (startHour - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;
            const heightPixels = duration * PIXELS_PER_HOUR;

            const el = document.createElement('div');
            el.className = 'calendar-event';
            el.style.top = `${topPixels}px`;
            el.style.height = `${heightPixels}px`;
            el.draggable = true;
            el.dataset.dealId = deal.ID;
            el.dataset.currentDuration = duration; // Para manter a duração ao arrastar
            
            const instaladores = schedule.instaladores ? schedule.instaladores.split(',') : [];
            const tagsHtml = instaladores.map(i => `<span class="tag-installer">${i.trim()}</span>`).join('');

            const timeStr = `${start.getHours().toString().padStart(2,'0')}:${start.getMinutes().toString().padStart(2,'0')}`;

            el.innerHTML = `
                <button class="btn-edit-event"><i class="fas fa-pencil-alt"></i></button>
                <div class="event-time">${timeStr}</div>
                <div class="event-title">#${deal.TITLE} - ${deal[NOME_CLIENTE_FIELD] || ''}</div>
                <div class="event-tags">${tagsHtml}</div>
            `;

            el.addEventListener('dragstart', handleDragStart);
            
            // Botão Editar (Abre modal para mudar duração/instaladores)
            el.querySelector('.btn-edit-event').addEventListener('click', (e) => {
                e.stopPropagation();
                openScheduleModal(deal, schedule);
            });
            
            // Clique no card abre visualização normal
            el.addEventListener('click', () => openDetailsModal(deal.ID));

            parentColumn.appendChild(el);
        }

        function addRedNeedle(column) {
            const needle = document.createElement('div');
            needle.className = 'current-time-line';
            needle.innerHTML = '<div class="current-time-circle"></div>';
            column.appendChild(needle);

            function updateNeedle() {
                const now = new Date();
                const hours = now.getHours() + (now.getMinutes() / 60);
                if (hours >= CALENDAR_START_HOUR && hours <= CALENDAR_END_HOUR) {
                    const top = (hours - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;
                    needle.style.top = `${top}px`;
                    needle.style.display = 'block';
                } else {
                    needle.style.display = 'none';
                }
            }
            updateNeedle();
            setInterval(updateNeedle, 60000); // Atualiza a cada minuto
        }

        // --- DRAG AND DROP LOGIC ---
        let draggedItem = null;
        let draggedDuration = 2; // Padrão se não tiver definido

        function handleDragStart(e) {
            draggedItem = this;
            e.dataTransfer.setData('text/plain', this.dataset.dealId);
            e.dataTransfer.effectAllowed = 'move';
            
            // Se já for um evento do calendário, pega a duração atual
            if (this.dataset.currentDuration) {
                draggedDuration = parseFloat(this.dataset.currentDuration);
            } else {
                draggedDuration = 2; // Default vindo do backlog
            }
        }

        function handleDragOver(e) {
            e.preventDefault();
            this.classList.add('droppable-hover');
            e.dataTransfer.dropEffect = 'move';
        }

        function handleDragLeave(e) {
            this.classList.remove('droppable-hover');
        }

        async function handleDropOnCalendar(e) {
            e.preventDefault();
            this.classList.remove('droppable-hover');
            
            const dealId = e.dataTransfer.getData('text/plain');
            if (!dealId) return;

            // Calcular Hora baseada na posição Y do clique
            const rect = this.getBoundingClientRect();
            const offsetY = e.clientY - rect.top + this.scrollTop; // Posição Y dentro da coluna
            
            // Converter pixels para horas
            // offsetY = (hours - START) * PIXELS
            // hours = (offsetY / PIXELS) + START
            let dropHourDecimal = (offsetY / PIXELS_PER_HOUR) + CALENDAR_START_HOUR;
            
            // "Snap" para meia hora (arredondar para .0 ou .5)
            dropHourDecimal = Math.round(dropHourDecimal * 2) / 2;
            
            // Limites
            if (dropHourDecimal < CALENDAR_START_HOUR) dropHourDecimal = CALENDAR_START_HOUR;
            if ((dropHourDecimal + draggedDuration) > CALENDAR_END_HOUR) dropHourDecimal = CALENDAR_END_HOUR - draggedDuration;

            // Construir Datas
            const dateIso = this.dataset.dateIso; // YYYY-MM-DD
            const startTime = new Date(`${dateIso}T00:00:00`);
            const h = Math.floor(dropHourDecimal);
            const m = (dropHourDecimal - h) * 60;
            startTime.setHours(h, m, 0);

            const endTime = new Date(startTime);
            endTime.setHours(startTime.getHours() + Math.floor(draggedDuration));
            endTime.setMinutes(startTime.getMinutes() + ((draggedDuration % 1) * 60));

            // Preservar instaladores existentes
            const existingSchedule = getScheduleForDeal(dealId);
            const instaladores = existingSchedule ? existingSchedule.instaladores : '';

            // Salvar no Backend
            await saveSchedule(dealId, startTime, endTime, instaladores);
        }

        async function saveSchedule(dealId, start, end, instaladores) {
            showToast('Salvando...', 'success');
            try {
                const res = await fetch('/api/instalacao/saveSchedule', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dealId: dealId,
                        startTime: start.toISOString(),
                        endTime: end.toISOString(),
                        instaladores: instaladores
                    })
                });

                if (res.ok) {
                    // Atualiza localmente e re-renderiza
                    const existingIndex = allSchedules.findIndex(s => s.bitrix_deal_id == dealId);
                    const newEntry = { 
                        bitrix_deal_id: parseInt(dealId), 
                        start_time: start.toISOString(), 
                        end_time: end.toISOString(), 
                        instaladores: instaladores 
                    };

                    if (existingIndex >= 0) allSchedules[existingIndex] = newEntry;
                    else allSchedules.push(newEntry);

                    renderCalendar();
                    showToast('Agendado!', 'success');
                } else {
                    showToast('Erro ao salvar.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Erro de conexão.', 'error');
            }
        }

        // --- MODAL DE EDIÇÃO DE AGENDAMENTO ---
        function openScheduleModal(deal, schedule) {
            currentEditingDealId = deal.ID;
            inputInstaladores.value = schedule.instaladores || '';
            
            const start = new Date(schedule.start_time);
            const end = new Date(schedule.end_time);
            const duration = (end - start) / (1000 * 60 * 60);
            inputDuracao.value = duration.toFixed(1);

            modalAgendamento.classList.add('active');
        }

        btnSalvarAgendamento.addEventListener('click', async () => {
            if (!currentEditingDealId) return;

            const schedule = getScheduleForDeal(currentEditingDealId);
            if (!schedule) return;

            const novoInstaladores = inputInstaladores.value;
            const novaDuracao = parseFloat(inputDuracao.value);

            if (isNaN(novaDuracao) || novaDuracao <= 0) {
                alert("Duração inválida");
                return;
            }

            // Recalcula End Time
            const start = new Date(schedule.start_time);
            const end = new Date(start);
            end.setMinutes(start.getMinutes() + (novaDuracao * 60));

            await saveSchedule(currentEditingDealId, start, end, novoInstaladores);
            modalAgendamento.classList.remove('active');
        });

        // Fechar Modal Agendamento
        modalAgendamento.querySelector('.close-modal').addEventListener('click', () => {
            modalAgendamento.classList.remove('active');
        });

        // --- CONTROLE DE VIEWS ---
        btnViewKanban.addEventListener('click', () => {
            boardKanban.classList.remove('hidden');
            boardCalendar.classList.add('hidden');
            btnViewKanban.classList.add('active');
            btnViewCalendar.classList.remove('active');
        });

        btnViewCalendar.addEventListener('click', () => {
            boardKanban.classList.add('hidden');
            boardCalendar.classList.remove('hidden');
            btnViewKanban.classList.remove('active');
            btnViewCalendar.classList.add('active');
            renderCalendar(); // Re-renderiza para garantir posição correta da agulha
        });

        // --- MODAL DETALHES (Mantido do anterior, apenas função auxiliar necessária) ---
        function openDetailsModal(dealId) {
            // Lógica existente do seu modal anterior...
            // Copie aqui o conteúdo da função openDetailsModal do seu arquivo original
            // Para brevidade, assumi que ela existe e funciona igual
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            
            modalTitle.textContent = `Instalação Externa #${deal.TITLE || deal.ID}`;
            
            // ... (Resto da lógica de renderização do modal que você já tem) ...
            // Como seu código original já tinha isso, apenas certifique-se de 
            // que esta função está presente neste escopo.
            
            // SIMULAÇÃO DO CONTEÚDO (Copie do seu original)
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const rawLink = deal[LAYOUT_FIELD];
            let imageHtml = rawLink ? `<img src="${rawLink}" class="layout-img" style="max-width:100%">` : '<p>Sem imagem</p>';
            
            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">${imageHtml}</div>
                    <div class="detalhe-col-lateral">
                        <h3>${nomeCliente}</h3>
                        <p>Use este modal para concluir a instalação (lógica original).</p>
                    </div>
                </div>
            `;
            modal.classList.add('active');
        }

        // Global listeners para modais
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        
        // Start
        loadAllData();
    });
})();