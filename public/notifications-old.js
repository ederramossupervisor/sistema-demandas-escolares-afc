/**
 * 🔔 Sistema de Notificações Visuais Inteligentes
 * Versão 3.0 - Com Sistema de Fila
 */

// ============================================
// 🎯 CONFIGURAÇÕES DO SISTEMA
// ============================================

let notificationContainer = null;
let isScrollListenerActive = false;
let scrollTimeout = null;
let resizeTimeout = null;

// 🆕 SISTEMA DE FILA
let notificationQueue = [];
let visibleNotifications = [];
const MAX_VISIBLE_NOTIFICATIONS = 3;
const NOTIFICATION_TYPES = {
    ERROR: { priority: 4, color: '#ef4444', icon: 'exclamation-circle' },
    WARNING: { priority: 3, color: '#f59e0b', icon: 'exclamation-triangle' },
    SUCCESS: { priority: 2, color: '#10b981', icon: 'check-circle' },
    INFO: { priority: 1, color: '#0096E1', icon: 'info-circle' }
};

// 🆕 CONTROLE DE ESTADO
let isQueueProcessing = false;
let totalNotificationsShown = 0;

// ============================================
// 🎯 SISTEMA INTELIGENTE DE POSIÇÃO
// ============================================

/**
 * Ajusta a posição das notificações baseada no scroll
 * - Topo da página: notificações no topo
 * - Meio da página: notificações no meio (30% da tela)
 * - Final da página: notificações no rodapé
 */
function ajustarPosicaoNotificacoes() {
    console.log('🎯 AJUSTANDO POSIÇÃO...');
    
    const container = notificationContainer;
    if (!container) {
        console.log('❌ Container não encontrado');
        return;
    }
    
    // 📊 MEDIDAS ATUAIS
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    console.log('📈 Dados:', {
        scrollTop: scrollTop,
        windowHeight: windowHeight,
        documentHeight: documentHeight,
        scrollBottom: scrollTop + windowHeight,
        documentBottom: documentHeight - 300
    });
    
    // 🎯 CÁLCULO CORRETO: Verifica posição RELATIVA
    const isNearTop = scrollTop < 300;
    const isNearBottom = (scrollTop + windowHeight) > (documentHeight - 300);
    
    console.log('📍 Verificações:', {
        isNearTop: isNearTop,
        isNearBottom: isNearBottom
    });
    
    // 🎨 REMOVE CLASSES ANTIGAS
    container.classList.remove('notification-top', 'notification-middle', 'notification-bottom');
    
    // 🚀 APLICA POSIÇÃO CORRETA
    if (isNearTop) {
        // 🔝 TOPO: Notificações fixas no topo
        container.style.top = '80px';
        container.style.bottom = 'auto';
        container.style.transform = 'translateY(0)';
        container.classList.add('notification-top');
        console.log('✅ Posição: TOPO (fixo)');
        
    } else if (isNearBottom) {
        // 🔽 RODAPÉ: Notificações fixas no rodapé
        container.style.top = 'auto';
        container.style.bottom = '20px';
        container.style.transform = 'translateY(0)';
        container.classList.add('notification-bottom');
        console.log('✅ Posição: RODAPÉ (fixo)');
        
    } else {
        // 🎯 MEIO: Notificações CENTRALIZADAS na tela VISÍVEL
        // IMPORTANTE: Usamos posição FIXA em relação à VIEWPORT
        const viewportMiddle = windowHeight * 0.5; // 50% da altura visível
        container.style.top = `${viewportMiddle}px`;
        container.style.bottom = 'auto';
        container.style.transform = 'translateY(-50%)'; // Centraliza verticalmente
        container.classList.add('notification-middle');
        console.log('✅ Posição: MEIO (centralizado na tela)');
        console.log('   Calculado:', viewportMiddle + 'px');
    }
    
    // 🎨 FORÇA REDRAW (para animação)
    container.style.display = 'none';
    container.offsetHeight; // Trigger reflow
    container.style.display = 'flex';
    
    console.log('🎉 Posição ajustada com sucesso!');
    console.log('---');
}
/**
 * Configura os listeners de scroll e resize
 */
function configurarListenersDeScroll() {
    if (isScrollListenerActive) {
        return;
    }
    
    // Remove listeners antigos (prevenção)
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleResize);
    
    // Adiciona novos listeners
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    
    isScrollListenerActive = true;
    console.log('🎯 Listeners de scroll configurados!');
}

/**
 * Handler para scroll com debounce
 */
function handleScroll() {
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }
    
    scrollTimeout = setTimeout(() => {
        ajustarPosicaoNotificacoes();
    }, 50);
}

/**
 * Handler para resize com debounce
 */
function handleResize() {
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }
    
    resizeTimeout = setTimeout(() => {
        ajustarPosicaoNotificacoes();
    }, 100);
}

// ============================================
// 🚀 FUNÇÕES PRINCIPAIS DO SISTEMA
// ============================================

/**
 * Inicializa o sistema de notificações
 */
function initNotifications() {
    console.log('🔔 Inicializando sistema de notificações...');
    
    // Remove container existente se houver
    const oldContainer = document.getElementById('notification-system-container');
    if (oldContainer && oldContainer.parentNode) {
        oldContainer.parentNode.removeChild(oldContainer);
        notificationContainer = null;
    }
    
    // Cria o container COM BACKGROUND CORRETO
    notificationContainer = document.createElement('div');
    notificationContainer.className = 'notification-container notification-top';
    notificationContainer.id = 'notification-system-container';
    notificationContainer.setAttribute('aria-live', 'polite');
    notificationContainer.setAttribute('aria-atomic', 'true');
    
    // 🎨 ESTILOS CORRETOS - SEM BACKGROUND TRANSLÚCIDO
    notificationContainer.style.cssText = `
        position: fixed !important;
        right: 20px !important;
        z-index: 99999 !important;
        max-width: 350px !important;
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
        pointer-events: none !important;
        
        /* 🎯 REMOVE BACKGROUND TRANSLÚCIDO */
        background: transparent !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        padding: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        
        /* 🎯 GARANTIR VISIBILIDADE COMPLETA */
        opacity: 1 !important;
        visibility: visible !important;
    `;
    
    document.body.appendChild(notificationContainer);
    
    // Configura os listeners
    configurarListenersDeScroll();
    
    // Ajusta posição inicial
    setTimeout(() => {
        ajustarPosicaoNotificacoes();
        
        // Testa o sistema (apenas em desenvolvimento)
        if (window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1')) {
            console.log('✅ Sistema pronto! Teste com: showSuccess("Teste", "Notificação funcionando!")');
        }
    }, 300);
    
    console.log('📦 Container de notificações criado (sem transparência)!');
}

// ============================================
// 📢 FUNÇÃO PRINCIPAL showNotification
// ============================================

function showNotification(type, title, message, duration = 5000, options = {}) {
    console.log(`📢 showNotification: ${type} - "${title}"`);
    
    // Valida tipo
    const tiposValidos = ['success', 'error', 'warning', 'info'];
    if (!tiposValidos.includes(type)) {
        console.warn(`⚠️ Tipo inválido: ${type}. Usando 'info'.`);
        type = 'info';
    }
    
    // Inicializa se necessário
    if (!notificationContainer) {
        console.log('⚡ Sistema não inicializado. Inicializando...');
        initNotifications();
        // Tenta novamente após inicialização
        setTimeout(() => showNotification(type, title, message, duration, options), 100);
        return 'pending-init';
    }
    
    // Cria objeto da notificação
    const notificationId = 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const priority = NOTIFICATION_TYPES[type.toUpperCase()]?.priority || 1;
    
    const notificationData = {
        id: notificationId,
        type: type,
        title: title,
        message: message,
        duration: duration,
        priority: priority,
        timestamp: Date.now(),
        options: {
            canClose: options.canClose !== false,
            showCounter: options.showCounter !== false,
            pauseOnHover: options.pauseOnHover !== false,
            ...options
        },
        element: null,
        timeoutId: null
    };
    
    console.log(`📊 Nova notificação: ${type} (Prioridade: ${priority})`);
    
    // Adiciona à fila
    addToQueue(notificationData);
    
    // Processa a fila
    processQueue();
    
    return notificationId;
}
/**
 * 🆕 Adiciona notificação à fila (ordenada por prioridade)
 */
function addToQueue(notificationData) {
    // Insere na posição correta baseada na prioridade
    let inserted = false;
    for (let i = 0; i < notificationQueue.length; i++) {
        if (notificationData.priority > notificationQueue[i].priority) {
            notificationQueue.splice(i, 0, notificationData);
            inserted = true;
            break;
        }
    }
    
    if (!inserted) {
        notificationQueue.push(notificationData);
    }
    
    console.log(`📊 Fila atualizada: ${notificationQueue.length} notificação(ões) na fila`);
}

/**
 * 🆕 Processa a fila de notificações
 */
function processQueue() {
    if (isQueueProcessing || !notificationContainer) {
        return;
    }
    
    isQueueProcessing = true;
    
    // Remove notificações expiradas da lista de visíveis
    visibleNotifications = visibleNotifications.filter(notif => {
        return notif.element && notif.element.parentNode;
    });
    
    // Mostra notificações até atingir o limite
    while (visibleNotifications.length < MAX_VISIBLE_NOTIFICATIONS && notificationQueue.length > 0) {
        const nextNotification = notificationQueue.shift();
        showNotificationElement(nextNotification);
        visibleNotifications.push(nextNotification);
    }
    
    // 🆕 Atualiza contador se houver notificações na fila
    updateQueueCounter();
    
    isQueueProcessing = false;
    
    // Se ainda houver itens na fila, agenda próxima verificação
    if (notificationQueue.length > 0) {
        setTimeout(processQueue, 1000);
    }
}
/**
 * 🆕 Cria e mostra o elemento da notificação
 */
function showNotificationElement(notificationData) {
    totalNotificationsShown++;
    
    // Inicializa container se necessário
    if (!notificationContainer) {
        initNotifications();
        setTimeout(() => showNotificationElement(notificationData), 100);
        return;
    }
    
    const config = NOTIFICATION_TYPES[notificationData.type.toUpperCase()] || NOTIFICATION_TYPES.INFO;
    
    // Cria elemento
    const notification = document.createElement('div');
    notification.className = `notification ${notificationData.type} queued-notification`;
    notification.id = notificationData.id;
    notification.dataset.priority = notificationData.priority;
    notification.dataset.timestamp = notificationData.timestamp;
    
    // Permite pausar no hover
    if (notificationData.options.pauseOnHover) {
        notification.addEventListener('mouseenter', () => {
            if (notificationData.timeoutId) {
                clearTimeout(notificationData.timeoutId);
                notificationData.timeoutId = null;
                
                // Pausa a barra de progresso
                const progressBar = notification.querySelector('.notification-progress');
                if (progressBar) {
                    progressBar.style.animationPlayState = 'paused';
                }
            }
        });
        
        notification.addEventListener('mouseleave', () => {
            if (notificationData.duration > 0 && !notificationData.timeoutId) {
                startNotificationTimer(notificationData);
            }
        });
    }
    
    // HTML da notificação - VERSÃO COM ESTILOS GARANTIDOS
    notification.innerHTML = `
        <div style="
            background: ${config.color};
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            flex-shrink: 0;
            border: none;
            outline: none;
        ">
            <i class="fas fa-${config.icon}"></i>
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="
                font-weight: 600;
                color: #212529;
                font-size: 16px;
                margin-bottom: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span>${notificationData.title}</span>
                ${notificationData.options.showCounter ? `
                <span style="
                    background: ${config.color};
                    color: white;
                    font-size: 12px;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-weight: 500;
                ">
                    ${totalNotificationsShown}
                </span>
                ` : ''}
            </div>
            <div style="
                color: #6c757d;
                font-size: 14px;
                line-height: 1.4;
            ">
                ${notificationData.message}
            </div>
        </div>
        ${notificationData.options.canClose ? `
        <button onclick="closeNotificationById('${notificationData.id}')"
                style="
                    background: none;
                    border: none;
                    color: #6c757d;
                    cursor: pointer;
                    font-size: 18px;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                "
                onmouseover="this.style.backgroundColor='rgba(0,0,0,0.1)'; this.style.color='#dc3545'"
                onmouseout="this.style.backgroundColor='transparent'; this.style.color='#6c757d'">
            <i class="fas fa-times"></i>
        </button>
        ` : ''}
        ${notificationData.duration > 0 ? `
        <div style="
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            width: 100%;
            background: ${config.color};
            border-radius: 0 0 0 8px;
            transform-origin: left;
            animation: progressBar ${notificationData.duration}ms linear forwards;
        "></div>
        ` : ''}
    `;
    
    // Estilos COMPLETOS da notificação - TUDO INCLUÍDO
notification.style.cssText = `
    /* 🎨 FUNDO E CORES */
    background: white !important;
    background-color: white !important;
    border-left: 5px solid ${config.color} !important;
    border-radius: 10px !important;
    padding: 15px !important;
    
    /* 🎨 SOMBRA E ELEVAÇÃO */
    box-shadow: 0 5px 20px rgba(0,0,0,0.15) !important;
    
    /* 🎨 LAYOUT */
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    margin-bottom: 8px !important;
    
    /* 🎨 ANIMAÇÃO */
    transform: translateX(400px) !important;
    animation: slideIn 0.4s ease forwards !important;
    
    /* 🎨 POSICIONAMENTO */
    position: relative !important;
    overflow: hidden !important;
    
    /* 🎨 TRANSITION */
    transition: transform 0.3s ease, opacity 0.3s ease !important;
    
    /* 🎨 VISIBILIDADE */
    opacity: 1 !important;
    visibility: visible !important;
    
    /* 🎨 REMOVER TRANSPARÊNCIA */
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    
    /* 🎨 CORES DE TEXTO (IMPORTANTE!) */
    color: #212529 !important;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    
    /* 🎨 REMOVER BORDAS DO NAVEGADOR */
    border: none !important;
    outline: none !important;
    
    /* 🎨 GARANTIR DIMENSÕES */
    min-width: 300px !important;
    max-width: 350px !important;
    box-sizing: border-box !important;
`;
    
    // Adiciona ao container
    notificationContainer.appendChild(notification);
    notificationData.element = notification;
    
    // Adiciona animações se não existirem
    addNotificationAnimations();
    
    // Inicia timer para remoção automática
    if (notificationData.duration > 0) {
        startNotificationTimer(notificationData);
    }
    
    // Reajusta posição
    setTimeout(ajustarPosicaoNotificacoes, 50);
    
    console.log(`📤 Notificação mostrada: ${notificationData.title} (ID: ${notificationData.id})`);
    
    return notification;
}
/**
 * 🆕 Inicia o timer para remover notificação
 */
function startNotificationTimer(notificationData) {
    if (notificationData.duration <= 0) return;
    
    // Barra de progresso
    const progressBar = notificationData.element?.querySelector('.notification-progress');
    if (progressBar) {
        progressBar.style.animationPlayState = 'running';
    }
    
    // Timer para remover
    notificationData.timeoutId = setTimeout(() => {
        closeNotificationById(notificationData.id);
    }, notificationData.duration);
}

/**
 * 🆕 Fecha notificação pelo ID
 */
function closeNotificationById(notificationId) {
    // Remove da fila se ainda estiver nela
    notificationQueue = notificationQueue.filter(n => n.id !== notificationId);
    
    // Remove das visíveis
    const notificationIndex = visibleNotifications.findIndex(n => n.id === notificationId);
    if (notificationIndex !== -1) {
        const notificationData = visibleNotifications[notificationIndex];
        visibleNotifications.splice(notificationIndex, 1);
        
        // Limpa timeout
        if (notificationData.timeoutId) {
            clearTimeout(notificationData.timeoutId);
        }
        
        // Remove elemento com animação
        if (notificationData.element && notificationData.element.parentNode) {
            notificationData.element.style.transform = 'translateX(400px)';
            notificationData.element.style.opacity = '0';
            
            setTimeout(() => {
                if (notificationData.element.parentNode) {
                    notificationData.element.parentNode.removeChild(notificationData.element);
                    
                    // Reajusta posição
                    ajustarPosicaoNotificacoes();
                    
                    // Processa próxima na fila
                    setTimeout(processQueue, 300);
                }
            }, 300);
        }
    }
    
    // Remove elemento diretamente se existir
    const element = document.getElementById(notificationId);
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
    
    updateQueueCounter();
}

/**
 * 🆕 Atualiza contador da fila
 */
function updateQueueCounter() {
    const counterElement = document.getElementById('notification-queue-counter');
    
    if (notificationQueue.length > 0) {
        // Cria ou atualiza contador
        if (!counterElement) {
            const counter = document.createElement('div');
            counter.id = 'notification-queue-counter';
            counter.innerHTML = `
                <div style="
                    position: fixed;
                    bottom: 70px;
                    right: 20px;
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-weight: 600;
                    font-size: 14px;
                    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
                    z-index: 99998;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    animation: pulse 2s infinite;
                ">
                    <i class="fas fa-bell"></i>
                    <span>${notificationQueue.length} na fila</span>
                </div>
            `;
            
            // Adiciona clique para processar fila
            counter.addEventListener('click', () => {
                processQueue();
                counter.style.display = 'none';
            });
            
            document.body.appendChild(counter);
            
            // Adiciona animação de pulso
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        } else {
            // Atualiza contador existente
            counterElement.querySelector('span').textContent = `${notificationQueue.length} na fila`;
        }
    } else if (counterElement) {
        // Remove contador se não há fila
        counterElement.parentNode.removeChild(counterElement);
    }
}

/**
 * 🆕 Adiciona animações CSS necessárias
 */
function addNotificationAnimations() {
    if (document.getElementById('notification-animations')) return;
    
    const style = document.createElement('style');
    style.id = 'notification-animations';
    style.textContent = `
        @keyframes slideIn {
            to { transform: translateX(0); }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
        @keyframes progressBar {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
        }
        .notification.removing {
            animation: slideOut 0.4s ease forwards;
        }
    `;
    document.head.appendChild(style);
}

/**
 * 🆕 Fecha todas as notificações
 */
function closeAllNotifications() {
    console.log('🗑️ Fechando todas as notificações...');
    
    // Limpa fila
    notificationQueue = [];
    
    // Fecha todas visíveis
    visibleNotifications.forEach(notification => {
        closeNotificationById(notification.id);
    });
    
    // Limpa array
    visibleNotifications = [];
    
    updateQueueCounter();
}

/**
 * 🆕 Mostra painel de controle de notificações (para debug)
 */
function showNotificationControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'notification-control-panel';
    panel.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: white;
        border-radius: 10px;
        padding: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        z-index: 100000;
        max-width: 300px;
        font-family: system-ui, sans-serif;
    `;
    
    panel.innerHTML = `
        <h3 style="margin-top: 0; color: #0096E1;">🎛️ Controle de Notificações</h3>
        <div style="margin-bottom: 15px;">
            <strong>📊 Estatísticas:</strong><br>
            - Visíveis: ${visibleNotifications.length}<br>
            - Na fila: ${notificationQueue.length}<br>
            - Total mostradas: ${totalNotificationsShown}
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <button onclick="testNotificationQueue()" style="
                background: linear-gradient(135deg, #0096E1, #0077b3);
                color: white;
                border: none;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">
                🧪 Testar Fila
            </button>
            <button onclick="closeAllNotifications()" style="
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
                border: none;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">
                🗑️ Limpar Todas
            </button>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: #e5e7eb;
                color: #374151;
                border: none;
                padding: 10px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">
                Fechar Painel
            </button>
        </div>
    `;
    
    document.body.appendChild(panel);
}
/**
 * Fecha uma notificação específica
 * @param {HTMLElement} closeButton - Botão de fechar
 */
function closeNotification(closeButton) {
    const notification = closeButton.closest('.notification');
    closeNotificationByElement(notification);
}

/**
 * Fecha a notificação (com animação)
 * @param {HTMLElement} notification - Elemento da notificação
 */
function closeNotificationByElement(notification) {
    if (!notification || !notification.parentNode) return;
    
    // Animação de saída
    notification.classList.add('hiding');
    
    // Remove do DOM
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
            ajustarPosicaoNotificacoes();
        }
    }, 500);
}

// ============================================
// 🎯 FUNÇÕES DE ATALHO (SHORTCUTS)
// ============================================

function showSuccess(title, message, duration = 5000, options = {}) {
    return showNotification('success', title, message, duration, options);
}

function showError(title, message, duration = 7000, options = {}) {
    // Erros têm duração maior por padrão
    return showNotification('error', title, message, duration, {
        priority: 'high',
        pauseOnHover: true,
        ...options
    });
}

function showWarning(title, message, duration = 6000, options = {}) {
    return showNotification('warning', title, message, duration, {
        pauseOnHover: true,
        ...options
    });
}

function showInfo(title, message, duration = 5000, options = {}) {
    return showNotification('info', title, message, duration, options);
}

/**
 * Fecha todas as notificações
 */
function closeAllNotifications() {
    const notifications = document.querySelectorAll('.notification');
    notifications.forEach(notification => {
        closeNotificationByElement(notification);
    });
}

/**
 * Testa o sistema de posicionamento
 */
function testarSistemaDePosicao() {
    console.log('🧪 TESTANDO SISTEMA DE POSIÇÃO...');
    
    showInfo('Teste de Posição', 
        'Rode a página para ver as notificações se moverem automaticamente!', 
        10000
    );
    
    console.log('📊 ESTADO ATUAL:');
    console.log('- Scroll Y:', window.pageYOffset);
    console.log('- Altura da janela:', window.innerHeight);
    console.log('- Altura do documento:', document.documentElement.scrollHeight);
    console.log('- Container:', notificationContainer ? '✅ OK' : '❌ NÃO ENCONTRADO');
    
    if (notificationContainer) {
        console.log('- Posição atual:', notificationContainer.style.top || notificationContainer.style.bottom);
        console.log('- Classe atual:', notificationContainer.className);
    }
    
    console.log('\n🎯 TESTE MANUAL:');
    console.log('1. Rode a página até o topo → notificações no topo');
    console.log('2. Rode até o meio → notificações centralizam');
    console.log('3. Rode até o final → notificações no rodapé');
}

// ============================================
// 📦 INICIALIZAÇÃO E EXPORTAÇÃO
// ============================================

// Inicializa automaticamente
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotifications);
} else {
    setTimeout(initNotifications, 100);
}

// Torna as funções disponíveis globalmente
window.showNotification = showNotification;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;
window.closeAllNotifications = closeAllNotifications;
window.ajustarPosicaoNotificacoes = ajustarPosicaoNotificacoes;
window.testarSistemaDePosicao = testarSistemaDePosicao;
window.initNotifications = initNotifications;

// Variável para debug (opcional)
window.debugNotifications = false;

console.log('🔔 Sistema de notificações inteligentes carregado!');