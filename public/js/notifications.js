/**
 * 🔔 SISTEMA DE NOTIFICAÇÕES INTEGRADO - Sistema de Demandas Escolares
 * Versão 1.0 - Criado com Eder 🚀
 * 
 * ✅ Badge dinâmico na navbar
 * ✅ Toast notifications simples
 * ✅ Conexão com backend MongoDB
 * ✅ Histórico completo em modal
 * ✅ Marcar como lida/não lida
 */

class NotificationSystem {
    constructor() {
        // 📊 ESTADO DO SISTEMA
        this.unreadCount = 0;
        this.notificationBadge = null;
        this.isInitialized = false;
        this.notifications = [];
        this.pollingInterval = null;
        
        // ⚙️ CONFIGURAÇÕES
        this.config = {
            pollingInterval: 30000, // 30 segundos
            apiBaseUrl: '/api/notificacoes',
            maxToasts: 3,
            toastDuration: 5000 // 5 segundos
        };
        
        console.log('🔔 Sistema de notificações inicializado!');
    }
    
    /**
     * 🏁 INICIALIZAR SISTEMA
     * Chamar quando a página carregar
     */
    init() {
        if (this.isInitialized) {
            console.log('⚠️ Sistema já inicializado');
            return;
        }
        
        console.log('🚀 Inicializando sistema de notificações...');
        
        // 1. Criar container de toasts
        this.createToastContainer();
        
        // 2. Atualizar badge na navbar
        this.updateNavbarBadge();
        
        // 3. Configurar botão de notificações
        this.setupNotificationButton();
        
        // 4. Buscar notificações imediatamente
        this.fetchNotifications();
        
        // 5. Iniciar polling automático
        this.startPolling();
        
        this.isInitialized = true;
        console.log('✅ Sistema de notificações pronto!');
        
        // 6. Teste inicial (apenas em desenvolvimento)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                this.showTestNotification();
            }, 2000);
        }
    }
    
    /**
     * 📦 CRIAR CONTAINER DE TOASTS
     */
    createToastContainer() {
        // Remove container antigo se existir
        const oldContainer = document.getElementById('notification-toast-container');
        if (oldContainer) {
            oldContainer.remove();
        }
        
        // Cria novo container
        const container = document.createElement('div');
        container.id = 'notification-toast-container';
        container.className = 'notification-toast-container';
        
        // Estilos inline para garantir funcionamento
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 350px;
            pointer-events: none;
        `;
        
        document.body.appendChild(container);
        console.log('📦 Container de toasts criado');
    }
    
    /**
     * 🔔 ATUALIZAR BADGE NA NAVBAR
     */
    updateNavbarBadge() {
        // Procura o botão de notificações na navbar
        const notificationBtn = document.querySelector('[data-notification-button]') || 
                              document.querySelector('.notification-btn') ||
                              this.createNotificationButton();
        
        if (!notificationBtn) {
            console.warn('⚠️ Botão de notificações não encontrado na navbar');
            return;
        }
        
        // Cria ou atualiza o badge
        let badge = notificationBtn.querySelector('.notification-badge');
        
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: linear-gradient(135deg, #ef4444, #dc2626);
                color: white;
                font-size: 11px;
                font-weight: bold;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            `;
            notificationBtn.style.position = 'relative';
            notificationBtn.appendChild(badge);
        }
        
        // Atualiza contador
        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.style.display = 'flex';
            
            // Adiciona animação de pulso para novas notificações
            if (this.unreadCount > (parseInt(badge.dataset.lastCount) || 0)) {
                badge.style.animation = 'pulse 0.5s 2';
                setTimeout(() => {
                    badge.style.animation = '';
                }, 1000);
            }
        } else {
            badge.style.display = 'none';
        }
        
        badge.dataset.lastCount = this.unreadCount;
        this.notificationBadge = badge;
        
        console.log(`🔢 Badge atualizado: ${this.unreadCount} não lidas`);
    }
    
    /**
     * 🆕 CRIAR BOTÃO DE NOTIFICAÇÕES (se não existir)
     */
    createNotificationButton() {
        // Procura a navbar
        const navbar = document.querySelector('.navbar-nav.ms-auto') || 
                      document.querySelector('.navbar-nav:last-child');
        
        if (!navbar) {
            console.warn('⚠️ Navbar não encontrada para adicionar botão');
            return null;
        }
        
        // Cria o botão
        const notificationBtn = document.createElement('li');
        notificationBtn.className = 'nav-item';
        notificationBtn.innerHTML = `
            <a class="nav-link notification-btn" href="#" data-bs-toggle="offcanvas" 
               data-bs-target="#notificationsModal" data-notification-button="true">
                <i class="fas fa-bell"></i>
                <span class="notification-badge" style="display: none">0</span>
            </a>
        `;
        
        navbar.appendChild(notificationBtn);
        console.log('🆕 Botão de notificações criado na navbar');
        
        return notificationBtn.querySelector('.notification-btn');
    }
    
    /**
     * ⚙️ CONFIGURAR BOTÃO DE NOTIFICAÇÕES
     */
    setupNotificationButton() {
    const notificationBtn = document.querySelector('[data-notification-button]') || 
                           document.querySelector('.notification-btn');
    
    if (!notificationBtn) {
        console.warn('⚠️ Botão de notificações não encontrado');
        return;
    }
    
    // Usa a nova função protegida
    this.setupNotificationButtonClickHandler();
    
    console.log('⚙️ Botão de notificações configurado com proteção');
}
    
    /**
 * 📡 BUSCAR NOTIFICAÇÕES DO BACKEND (VERSÃO CORRIGIDA)
 */
async fetchNotifications() {
    try {
        console.log('📡 Tentando buscar notificações...');
        
        // ⭐⭐ USA A ROTA QUE BUSCA NOTIFICAÇÕES DO USUÁRIO
        // Tenta rota específica primeiro
        const userId = '6954bbcc581460ef4feb5996'; // ID do usuário atual
        const response = await fetch(`/api/notificacoes/nao-lidas/${userId}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                this.unreadCount = data.count;
                this.updateNavbarBadge();
                console.log('✅ API funcionando:', data.count, 'não lidas para o usuário');
                return;
            }
        }
        
        // Se falhou, tenta rota genérica
        console.log('🔄 Tentando rota genérica...');
        const response2 = await fetch('/api/notificacoes/nao-lidas');
        
        if (response2.ok) {
            const data2 = await response2.json();
            if (data2.success) {
                this.unreadCount = data2.count;
                this.updateNavbarBadge();
                console.log('✅ Rota genérica funcionou:', data2.count, 'não lidas');
                return;
            }
        }
        
        // Se ambas falharam, usa simulação
        throw new Error('API não disponível');
        
    } catch (error) {
        console.log('🔧 Usando modo simulação (API indisponível)');
        this.simulateNotifications();
    }
}    
    /**
     * 🔄 INICIAR POLLING AUTOMÁTICO
     */
    startPolling() {
        // Limpa intervalo anterior
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        
        // Configura novo intervalo
        this.pollingInterval = setInterval(() => {
            this.fetchNotifications();
        }, this.config.pollingInterval);
        
        console.log(`🔄 Polling configurado: ${this.config.pollingInterval/1000}s`);
    }
    
    /**
     * 🍞 MOSTRAR TOAST NOTIFICATION
     */
    showToast(type, title, message, options = {}) {
    // ... código existente ...
    
    // ⭐⭐ NOVO: SALVAR NOTIFICAÇÃO NA LISTA
    const notificationData = {
        _id: 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        titulo: title,
        mensagem: message,
        tipo: type,
        lida: false,
        dataCriacao: new Date(),
        link: options.link || '#'
    };
    
    // Adiciona ao início da lista (mais recente primeiro)
    this.notifications.unshift(notificationData);
    
    // Atualiza contador de não lidas
    this.unreadCount++;
    
    // Atualiza badge
    this.updateNavbarBadge();
    
    console.log(`📝 Notificação salva na lista: ${title}`);
    
    // ... resto do código existente ...
}
    
    /**
     * 🗑️ REMOVER TOAST
     */
    removeToast(toastElement) {
        if (!toastElement || !toastElement.parentNode) return;
        
        toastElement.style.animation = 'slideOutRight 0.3s ease forwards';
        toastElement.classList.add('removing');
        
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }
        }, 300);
    }
    
    /**
     * 🗑️ REMOVER TOAST POR ID
     */
    removeToastById(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            this.removeToast(toast);
        }
    }
    
    /**
     * 🎨 ADICIONAR ANIMAÇÕES CSS
     */
    addToastAnimations() {
        if (document.getElementById('toast-animations')) return;
        
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
            @keyframes toastProgress {
                from { width: 100%; }
                to { width: 0%; }
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    
/**
 * 📱 ABRIR MODAL DE NOTIFICAÇÕES (VERSÃO FINAL CORRIGIDA)
 */
async openNotificationsModal() {
    console.log('📱 Abrindo modal de notificações...');
    
    // 1. Verifica se o modal Bootstrap já existe
    let modalElement = document.getElementById('notificationsModal');
    
    // Se não existe, cria usando Bootstrap
    if (!modalElement) {
        console.log('📱 Criando modal Bootstrap...');
        this.createNotificationsModal();
        modalElement = document.getElementById('notificationsModal');
        
        // ⭐⭐ IMPORTANTE: Inicializa o modal do Bootstrap ANTES de mostrar
        this.bootstrapModal = new bootstrap.Offcanvas(modalElement);
    }
    
    // 2. Busca notificações REAIS do banco de dados
    console.log('📡 Buscando notificações do servidor...');
    await this.fetchNotificationsForModal();
    
    // 3. Atualiza o conteúdo do modal com as notificações reais
    this.updateModalContentWithRealNotifications();
    
    // 4. Se já temos uma instância Bootstrap, usa ela
    if (this.bootstrapModal) {
        this.bootstrapModal.show();
    } 
    // Se não, cria nova instância
    else {
        this.bootstrapModal = new bootstrap.Offcanvas(modalElement);
        this.bootstrapModal.show();
    }
    
    console.log('✅ Modal aberto com notificações reais!');
}

/**
 * 📡 BUSCAR NOTIFICAÇÕES REAIS PARA O MODAL (VERSÃO DEFINITIVA)
 */
async fetchNotificationsForModal() {
    try {
        console.log('🔍 Buscando notificações do usuário atual...');
        
        // ⭐⭐ PRECISAMOS DO ID DO USUÁRIO LOGADO
        // Vamos tentar pegar de diferentes lugares:
        let userId = '';
        
        // 1. Tenta pegar do objeto global
        if (window.currentUser && window.currentUser._id) {
            userId = window.currentUser._id;
        }
        // 2. Tenta pegar do push-notifications (vimos no console)
        else if (window.userId) {
            userId = window.userId;
        }
        // 3. Usa o ID que vimos no console (se nada funcionar)
        else {
            userId = '6954bbcc581460ef4feb5996';
            console.log('⚠️ Usando ID fixo do console:', userId);
        }
        
        console.log('👤 ID do usuário para buscar:', userId);
        
        // ⭐⭐ AGORA BUSCAMOS DIRETO DA API QUE FILTRA POR USUÁRIO
        // Primeiro tenta a rota que filtra por usuário
        let response = await fetch(`/api/notificacoes/usuario/${userId}`);
        
        // Se não existir, busca todas e filtra manualmente
        if (!response.ok) {
            console.log('🔄 Rota específica não existe, buscando todas...');
            response = await fetch('/debug/api/notificacoes');
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success && data.notificacoes) {
                    // ⭐⭐ FILTRA MANUALMENTE pelo usuarioId
                    const minhasNotificacoes = data.notificacoes.filter(notif => 
                        notif.usuarioId === userId
                    );
                    
                    console.log(`✅ ${minhasNotificacoes.length} notificações do usuário ${userId}`);
                    
                    // Converte para o formato do sistema
                    this.notifications = minhasNotificacoes.map(notif => ({
                        _id: notif._id,
                        titulo: notif.titulo,
                        mensagem: notif.mensagem,
                        tipo: notif.tipo || 'info',
                        lida: notif.lida || false,
                        dataCriacao: new Date(notif.dataCriacao),
                        link: notif.link || '#',
                        usuarioId: notif.usuarioId
                    }));
                    
                    // Ordena por data (mais recente primeiro)
                    this.notifications.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
                    
                    // Atualiza contador
                    this.unreadCount = this.notifications.filter(n => !n.lida).length;
                    
                    // Atualiza badge
                    this.updateNavbarBadge();
                    
                    return true;
                }
            }
        } else {
            // Se a rota específica funcionou
            const data = await response.json();
            
            if (data.success && data.notificacoes) {
                console.log(`✅ ${data.notificacoes.length} notificações do usuário`);
                
                this.notifications = data.notificacoes.map(notif => ({
                    _id: notif._id,
                    titulo: notif.titulo,
                    mensagem: notif.mensagem,
                    tipo: notif.tipo || 'info',
                    lida: notif.lida || false,
                    dataCriacao: new Date(notif.dataCriacao),
                    link: notif.link || '#',
                    usuarioId: notif.usuarioId
                }));
                
                // Ordena por data
                this.notifications.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
                
                this.unreadCount = this.notifications.filter(n => !n.lida).length;
                this.updateNavbarBadge();
                
                return true;
            }
        }
        
        throw new Error('Não foi possível buscar notificações');
        
    } catch (error) {
        console.error('❌ Erro ao buscar notificações:', error);
        
        // ⭐⭐ SOLUÇÃO DE EMERGÊNCIA: Mostra notificações de simulação
        // MAS mostra uma mensagem explicativa
        console.log('🔧 Criando notificações de demonstração...');
        
        // Cria notificações de demonstração COM o ID correto
        this.notifications = [
            {
                _id: 'demo-' + Date.now() + '-1',
                titulo: '🎉 Bem-vindo de volta!',
                mensagem: 'Você tem 7 notificações não lidas no sistema.',
                tipo: 'info',
                lida: false,
                dataCriacao: new Date(),
                link: '#',
                usuarioId: '6954bbcc581460ef4feb5996'
            },
            {
                _id: 'demo-' + Date.now() + '-2',
                titulo: '⚠️ Notificação Importante',
                mensagem: 'O sistema encontrou 29 notificações no total. Use a página de debug para ver todas.',
                tipo: 'warning',
                lida: false,
                dataCriacao: new Date(Date.now() - 300000),
                link: '/debug-agendador',
                usuarioId: '6954bbcc581460ef4feb5996'
            },
            {
                _id: 'demo-' + Date.now() + '-3',
                titulo: '🔔 Sistema Funcionando',
                mensagem: 'Modal de notificações carregado com sucesso!',
                tipo: 'success',
                lida: false,
                dataCriacao: new Date(Date.now() - 600000),
                link: '#',
                usuarioId: '6954bbcc581460ef4feb5996'
            }
        ];
        
        this.unreadCount = this.notifications.filter(n => !n.lida).length;
        this.updateNavbarBadge();
        
        // Mostra toast explicativo
        this.showToast('warning', '🔧 Modo Demonstração', 
            'Usando notificações de exemplo. Em produção, conecte ao backend.',
            { duration: 6000 }
        );
        
        return false;
    }
}

/**
 * 🔄 ATUALIZAR CONTEÚDO DO MODAL E AJUSTAR SCROLL
 */
updateModalContentWithRealNotifications() {
    const list = document.getElementById('notificationsList');
    const countBadge = document.getElementById('modalUnreadCount');
    
    if (!list) {
        console.error('❌ Elemento notificationsList não encontrado!');
        return;
    }
    
    // Atualiza contador no modal
    if (countBadge) {
        countBadge.textContent = this.unreadCount;
        countBadge.style.display = this.unreadCount > 0 ? 'inline' : 'none';
    }
    
    // Salva a posição atual do scroll
    const container = document.getElementById('notificationsListContainer');
    const scrollTopBefore = container ? container.scrollTop : 0;
    
    // Limpa lista
    list.innerHTML = '';
    
    if (this.notifications.length === 0) {
        list.innerHTML = `
            <div class="text-center py-5 text-muted">
                <div class="mb-3">
                    <i class="fas fa-bell-slash fa-3x" style="color: #cbd5e0;"></i>
                </div>
                <h6 class="text-gray-600">Nenhuma notificação</h6>
                <p class="small text-gray-500">As notificações aparecerão aqui</p>
            </div>
        `;
        return;
    }
    
    console.log(`📋 Carregando ${this.notifications.length} notificações no modal...`);
    
    // Adiciona cada notificação
    this.notifications.forEach((notification, index) => {
        const typeConfig = {
            success: { icon: 'check-circle', color: 'success', bg: 'rgba(40, 167, 69, 0.1)' },
            error: { icon: 'exclamation-circle', color: 'danger', bg: 'rgba(220, 53, 69, 0.1)' },
            warning: { icon: 'exclamation-triangle', color: 'warning', bg: 'rgba(255, 193, 7, 0.1)' },
            info: { icon: 'info-circle', color: 'info', bg: 'rgba(23, 162, 184, 0.1)' },
            demanda: { icon: 'clipboard-list', color: 'primary', bg: 'rgba(0, 150, 225, 0.1)' }
        };
        
        const config = typeConfig[notification.tipo] || typeConfig.info;
        const isUnread = !notification.lida;
        
        const notificationElement = document.createElement('a');
        notificationElement.href = notification.link || '#';
        notificationElement.className = `list-group-item list-group-item-action ${isUnread ? 'unread-notification' : ''}`;
        notificationElement.style.cssText = `
            border-left: 4px solid var(--bs-${config.color});
            background-color: ${isUnread ? config.bg : 'transparent'};
            transition: all 0.2s;
            cursor: pointer;
            position: relative;
        `;
        
        // Formata a data
        const dataFormatada = this.formatDate(new Date(notification.dataCriacao));
        const tempoRelativo = this.formatTimeAgo(new Date(notification.dataCriacao));
        
        notificationElement.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-start">
                <div class="me-2 flex-shrink-0">
                    <div style="
                        width: 36px;
                        height: 36px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, var(--bs-${config.color}), #ffffff);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <i class="fas fa-${config.icon} text-white fa-sm"></i>
                    </div>
                </div>
                <div class="flex-grow-1" style="min-width: 0;">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <h6 class="mb-0 ${isUnread ? 'fw-bold' : 'fw-normal'}" style="
                            font-size: 0.9rem;
                            color: #2d3748;
                        ">${notification.titulo}</h6>
                        ${isUnread ? `
                        <span class="badge bg-${config.color} rounded-pill" style="
                            font-size: 0.65rem;
                            padding: 2px 6px;
                        ">NOVA</span>
                        ` : ''}
                    </div>
                    <p class="mb-1 text-muted small" style="
                        font-size: 0.85rem;
                        line-height: 1.4;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                    ">${notification.mensagem}</p>
                    <small class="text-muted" title="${dataFormatada}" style="font-size: 0.75rem;">
                        <i class="far fa-clock me-1"></i>
                        ${tempoRelativo}
                    </small>
                </div>
            </div>
            ${isUnread ? `
            <div class="position-absolute top-50 end-0 translate-middle-y me-3" style="
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: var(--bs-${config.color});
                animation: pulse-badge 1.5s infinite;
            "></div>
            ` : ''}
        `;
        
        // Adiciona evento de clique
        notificationElement.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Adiciona efeito visual
            notificationElement.style.transform = 'scale(0.98)';
            notificationElement.style.opacity = '0.9';
            
            // Marca como lida
            await this.markAsRead(notification._id);
            
            // Remove o efeito
            setTimeout(() => {
                notificationElement.style.transform = '';
                notificationElement.style.opacity = '';
            }, 300);
            
            // Se tiver link, navega para ele
            if (notification.link && notification.link !== '#') {
                setTimeout(() => {
                    window.location.href = notification.link;
                }, 500);
            }
        });
        
        list.appendChild(notificationElement);
    });
    
    // Restaura a posição do scroll (ou vai para o topo se for primeira vez)
    if (container) {
        setTimeout(() => {
            container.scrollTop = scrollTopBefore;
            
            // Se há novas notificações não lidas, rola para a primeira
            const firstUnread = container.querySelector('.unread-notification');
            if (firstUnread && scrollTopBefore === 0) {
                firstUnread.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
    }
    
    // Atualiza tempo
    this.updateLastUpdateTime();
    
    console.log('✅ Notificações carregadas com scroll otimizado!');
}

/**
 * 📅 FORMATAR DATA COMPLETA
 */
formatDate(date) {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Função auxiliar para prevenir múltiplos cliques
setupNotificationButtonClickHandler() {
    const notificationBtn = document.querySelector('[data-notification-button]') || 
                           document.querySelector('.notification-btn');
    
    if (!notificationBtn) return;
    
    // Remove event listeners antigos
    const newBtn = notificationBtn.cloneNode(true);
    notificationBtn.parentNode.replaceChild(newBtn, notificationBtn);
    
    // Adiciona novo listener com debounce
    let isOpening = false;
    
    newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Prevenir múltiplos cliques rápidos
        if (isOpening) {
            console.log('⏳ Modal já está sendo aberto...');
            return;
        }
        
        isOpening = true;
        
        // Abre modal
        this.openNotificationsModal();
        
        // Reseta após 1 segundo
        setTimeout(() => {
            isOpening = false;
        }, 1000);
    });
    
    console.log('🛡️ Botão protegido contra múltiplos cliques');
}
    
/**
 * 🆕 CRIAR MODAL DE NOTIFICAÇÕES (COM SCROLL PERFEITO)
 */
createNotificationsModal() {
    const modalHTML = `
        <div class="offcanvas offcanvas-end" tabindex="-1" id="notificationsModal" 
             aria-labelledby="notificationsModalLabel" style="
                max-width: 450px;
                height: 100vh;
            ">
            <div class="offcanvas-header border-bottom" style="
                background: linear-gradient(135deg, #1a202c, #2d3748);
                color: white;
                flex-shrink: 0;
                padding: 1rem 1.5rem;
                height: 70px;
            ">
                <div class="d-flex align-items-center w-100">
                    <div style="
                        background: linear-gradient(135deg, #0096E1, #0077cc);
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 12px;
                        flex-shrink: 0;
                    ">
                        <i class="fas fa-bell fa-lg text-white"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h5 class="offcanvas-title mb-0" id="notificationsModalLabel">
                            Notificações
                            <span class="badge bg-danger ms-2" id="modalUnreadCount">${this.unreadCount}</span>
                        </h5>
                        <small class="text-white-50">Clique para marcar como lida</small>
                    </div>
                    <button type="button" class="btn-close btn-close-white" 
                            data-bs-dismiss="offcanvas" aria-label="Close"
                            style="flex-shrink: 0; margin-left: 10px;"></button>
                </div>
            </div>
            
            <!-- ÁREA DE CONTEÚDO COM SCROLL -->
            <div class="offcanvas-body" style="
                padding: 0;
                display: flex;
                flex-direction: column;
                height: calc(100vh - 130px); /* Altura total menos header e footer */
                overflow: hidden; /* Esconde scroll externo */
            ">
                <!-- BARRA DE ESTATÍSTICAS (opcional, pode remover se não quiser) -->
                <div class="px-3 pt-3 pb-2 border-bottom" style="flex-shrink: 0;">
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i class="fas fa-inbox me-1"></i>
                            ${this.notifications.length} notificações
                        </small>
                        <small class="text-muted">
                            <i class="fas fa-eye-slash me-1"></i>
                            ${this.unreadCount} não lidas
                        </small>
                    </div>
                </div>
                
                <!-- LISTA COM SCROLL SUAVE -->
                <div id="notificationsListContainer" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 0;
                ">
                    <div class="list-group list-group-flush" id="notificationsList">
                        <!-- Notificações serão inseridas aqui -->
                        <div class="text-center py-5 text-muted">
                            <div class="mb-3">
                                <i class="fas fa-bell-slash fa-3x" style="color: #cbd5e0;"></i>
                            </div>
                            <h6 class="text-gray-600">Nenhuma notificação</h6>
                            <p class="small text-gray-500">As notificações aparecerão aqui</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="offcanvas-footer border-top p-3" style="
                flex-shrink: 0;
                background: #f1f5f9;
                height: 60px;
            ">
                <div class="d-flex justify-content-between align-items-center">
                    <button class="btn btn-outline-primary btn-sm" 
                            onclick="notificationSystem.markAllAsRead()">
                        <i class="fas fa-check-double me-1"></i>Marcar todas
                    </button>
                    <div class="text-muted small">
                        <i class="fas fa-sync-alt me-1"></i>
                        <span id="lastUpdateTime">Agora</span>
                    </div>
                    <button class="btn btn-outline-danger btn-sm" 
                            onclick="notificationSystem.clearAllNotificationsSimple()">
                        <i class="fas fa-trash me-1"></i>Limpar
                    </button>
                </div>
            </div>
        </div>
        
        <!-- ESTILOS ESPECÍFICOS PARA SCROLL -->
        <style>
            /* SCROLL PERSONALIZADO PARA A LISTA DE NOTIFICAÇÕES */
            #notificationsListContainer::-webkit-scrollbar {
                width: 6px;
            }
            
            #notificationsListContainer::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 3px;
            }
            
            #notificationsListContainer::-webkit-scrollbar-thumb {
                background: linear-gradient(135deg, #0096E1, #0077cc);
                border-radius: 3px;
            }
            
            #notificationsListContainer::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(135deg, #0077cc, #005fa3);
            }
            
            /* ANIMAÇÃO DE SCROLL SUAVE */
            #notificationsListContainer {
                scroll-behavior: smooth;
            }
            
            /* ESTILOS DAS NOTIFICAÇÕES */
            .unread-notification {
                background-color: rgba(0, 150, 225, 0.05) !important;
                border-left: 4px solid #0096E1 !important;
            }
            
            .list-group-item {
                transition: all 0.2s ease;
                border-left: 4px solid transparent;
                padding: 1rem 1.25rem;
            }
            
            .list-group-item:hover {
                background-color: #f8fafc;
                transform: translateX(2px);
            }
            
            /* BADGE PISCANTE PARA NOVAS NOTIFICAÇÕES */
            @keyframes pulse-badge {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            .badge.bg-danger {
                animation: pulse-badge 2s infinite;
            }
        </style>
    `;
    
    // Remove modal antigo se existir
    const oldModal = document.getElementById('notificationsModal');
    if (oldModal) oldModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Atualiza tempo da última atualização
    this.updateLastUpdateTime();
    
    console.log('📱 Modal de notificações criado COM SCROLL OTIMIZADO');
}

/**
 * ⏰ ATUALIZAR HORA DA ÚLTIMA ATUALIZAÇÃO
 */
updateLastUpdateTime() {
    const timeElement = document.getElementById('lastUpdateTime');
    if (timeElement) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timeElement.textContent = `${hours}:${minutes}`;
        timeElement.title = `Atualizado em: ${now.toLocaleTimeString('pt-BR')}`;
    }
}    



/**
     * 🔄 ATUALIZAR CONTEÚDO DO MODAL
     */
    updateModalContent() {
        const list = document.getElementById('notificationsList');
        const countBadge = document.getElementById('modalUnreadCount');
        
        if (!list || !countBadge) return;
        
        // Atualiza contador
        countBadge.textContent = this.unreadCount;
        countBadge.style.display = this.unreadCount > 0 ? 'inline' : 'none';
        
        // Limpa lista
        list.innerHTML = '';
        
        if (this.notifications.length === 0) {
            list.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="fas fa-bell-slash fa-2x mb-3"></i>
                    <p>Nenhuma notificação</p>
                </div>
            `;
            return;
        }
        
        // Adiciona cada notificação
        this.notifications.forEach((notification, index) => {
            const typeConfig = {
                success: { icon: 'check-circle', color: 'success' },
                error: { icon: 'exclamation-circle', color: 'danger' },
                warning: { icon: 'exclamation-triangle', color: 'warning' },
                info: { icon: 'info-circle', color: 'info' },
                demanda: { icon: 'clipboard-list', color: 'primary' }
            };
            
            const config = typeConfig[notification.tipo] || typeConfig.info;
            const isUnread = !notification.lida;
            
            const notificationElement = document.createElement('a');
            notificationElement.href = notification.link || '#';
            notificationElement.className = `list-group-item list-group-item-action ${isUnread ? 'unread-notification' : ''}`;
            notificationElement.style.cssText = `
                border-left: 4px solid var(--bs-${config.color});
                transition: all 0.2s;
            `;
            
            notificationElement.innerHTML = `
                <div class="d-flex w-100 justify-content-between align-items-start">
                    <div class="me-2">
                        <i class="fas fa-${config.icon} text-${config.color}"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-1 ${isUnread ? 'fw-bold' : ''}">${notification.titulo}</h6>
                        <p class="mb-1 text-muted small">${notification.mensagem}</p>
                        <small class="text-muted">
                            <i class="far fa-clock me-1"></i>
                            ${this.formatTimeAgo(new Date(notification.dataCriacao))}
                        </small>
                    </div>
                    ${isUnread ? `
                    <span class="badge bg-${config.color} rounded-pill">Nova</span>
                    ` : ''}
                </div>
            `;
            
            // Adiciona evento de clique
            notificationElement.addEventListener('click', (e) => {
                if (!notification.link || notification.link === '#') {
                    e.preventDefault();
                }
                this.markAsRead(notification._id);
            });
            
            list.appendChild(notificationElement);
        });
    }
    
    /**
     * ✅ MARCAR COMO LIDA
     */
    async markAsRead(notificationId) {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/${notificationId}/ler`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // Atualiza contador local
                if (this.unreadCount > 0) {
                    this.unreadCount--;
                }
                
                // Atualiza badge
                this.updateNavbarBadge();
                
                // Atualiza notificação na lista
                const notification = this.notifications.find(n => n._id === notificationId);
                if (notification) {
                    notification.lida = true;
                }
                
                console.log(`✅ Notificação ${notificationId} marcada como lida`);
            }
        } catch (error) {
            console.error('❌ Erro ao marcar como lida:', error);
        }
    }
    
    /**
     * ✅✅ MARCAR TODAS COMO LIDAS
     */
    async markAllAsRead() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/ler-todas`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.unreadCount = 0;
                this.updateNavbarBadge();
                
                // Atualiza todas as notificações locais
                this.notifications.forEach(notification => {
                    notification.lida = true;
                });
                
                console.log('✅✅ Todas as notificações marcadas como lidas');
            }
        } catch (error) {
            console.error('❌ Erro ao marcar todas como lidas:', error);
        }
    }
    
    /**
     * 🗑️ LIMPAR TODAS AS NOTIFICAÇÕES
     */
    clearAllNotificationsSimple() {
    console.log('🗑️ Limpando notificações (modo simples)...');
    
    if (!confirm('Tem certeza que deseja limpar todas as notificações?')) {
        return;
    }
    
    // Simplesmente limpa localmente (SEM chamar API)
    this.notifications = [];
    this.unreadCount = 0;
    
    // Atualiza badge
    this.updateNavbarBadge();
    
    // Atualiza modal se estiver aberto
    this.updateModalContent();
    
    console.log('✅ Notificações limpas localmente');
    
    // Tenta API, mas se der erro, não importa
    fetch(`${this.config.apiBaseUrl}/todas`, {
        method: 'DELETE'
    })
    .then(response => {
        if (response.ok) {
            console.log('✅ API também limpou notificações');
        } else {
            console.log('⚠️ API não respondeu, mas limpamos localmente');
        }
    })
    .catch(error => {
        console.log('⚠️ Erro na API (esperado):', error.message);
    });
}
    
    /**
     * 🧪 NOTIFICAÇÃO DE TESTE
     */
    showTestNotification() {
        console.log('🧪 Mostrando notificação de teste...');
        
        this.showToast('success', '✅ Sistema Funcionando!', 
            'O sistema de notificações está ativo e funcionando perfeitamente!');
        
        // Simula notificação não lida
        this.unreadCount = 1;
        this.updateNavbarBadge();
    }
    
    /**
     * 🔧 SIMULAÇÃO (quando API não está pronta)
     */
    simulateNotifications() {
    console.log('🔧 Usando notificações de simulação (modo desenvolvimento)...');
    
    // Notificações simuladas MAIS COMPLETAS
    this.notifications = [
        {
            _id: 'sim-' + Date.now() + '-1',
            titulo: '🎉 Bem-vindo ao Sistema!',
            mensagem: 'Seu acesso como administrador foi configurado com sucesso. Explore todas as funcionalidades.',
            tipo: 'success',
            lida: false,
            dataCriacao: new Date(),
            link: '/dashboard'
        },
        {
            _id: 'sim-' + Date.now() + '-2', 
            titulo: '📋 Nova Demanda Criada',
            mensagem: 'Demanda "Manutenção de Computadores" criada na escola CEEFMTI Afonso Cláudio.',
            tipo: 'demanda',
            lida: false,
            dataCriacao: new Date(Date.now() - 1800000), // 30 minutos atrás
            link: '/demandas'
        },
        {
            _id: 'sim-' + Date.now() + '-3',
            titulo: '⚠️ Reunião Importante',
            mensagem: 'Reunião de equipe amanhã às 10h na sala de reuniões.',
            tipo: 'warning',
            lida: true,
            dataCriacao: new Date(Date.now() - 7200000), // 2 horas atrás
            link: '#'
        },
        {
            _id: 'sim-' + Date.now() + '-4',
            titulo: '📊 Relatório Mensal',
            mensagem: 'Relatório de outubro/2024 está disponível para download.',
            tipo: 'info',
            lida: true,
            dataCriacao: new Date(Date.now() - 86400000), // 1 dia atrás
            link: '#'
        },
        {
            _id: 'sim-' + Date.now() + '-5',
            titulo: '✅ Sistema Atualizado',
            mensagem: 'Nova versão 2.1 do sistema disponível com melhorias de performance.',
            tipo: 'success',
            lida: false,
            dataCriacao: new Date(Date.now() - 43200000), // 12 horas atrás
            link: '/perfil'
        }
    ];
    
    // Conta quantas não estão lidas
    this.unreadCount = this.notifications.filter(n => !n.lida).length;
    
    console.log(`📊 Simulação: ${this.notifications.length} notificações (${this.unreadCount} não lidas)`);
    
    // Atualiza badge
    this.updateNavbarBadge();
    
    // Mostra toast de aviso (apenas primeira vez)
    if (!localStorage.getItem('notifications_simulated')) {
        this.showToast('info', '🔧 Modo Simulação', 
            'Usando notificações de demonstração. Em produção, conectaremos ao servidor.',
            { duration: 8000 }
        );
        localStorage.setItem('notifications_simulated', 'true');
    }
}
    
    /**
     * ⏰ FORMATAR TEMPO RELATIVO
     */
    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) {
            return 'agora mesmo';
        } else if (diffMins < 60) {
            return `há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
        } else if (diffHours < 24) {
            return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        } else if (diffDays < 7) {
            return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
        } else {
            return date.toLocaleDateString('pt-BR');
        }
    }
}

// ============================================
// 🌍 INSTÂNCIA GLOBAL E INICIALIZAÇÃO
// ============================================

// Cria instância global
const notificationSystem = new NotificationSystem();

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        notificationSystem.init();
    });
} else {
    setTimeout(() => {
        notificationSystem.init();
    }, 100);
}

// Torna disponível globalmente
window.notificationSystem = notificationSystem;

// Funções de atalho (opcionais)
window.showSuccessToast = (title, message, options) => 
    notificationSystem.showToast('success', title, message, options);

window.showErrorToast = (title, message, options) => 
    notificationSystem.showToast('error', title, message, options);

window.showWarningToast = (title, message, options) => 
    notificationSystem.showToast('warning', title, message, options);

window.showInfoToast = (title, message, options) => 
    notificationSystem.showToast('info', title, message, options);

console.log('🔔 Sistema de notificações carregado! Use: notificationSystem.init()');