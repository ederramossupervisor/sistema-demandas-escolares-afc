// ============================================
// SISTEMA DE NOTIFICAÇÕES PUSH EM TEMPO REAL
// ============================================

class PushNotificationSystem {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.notificationPermission = null;
        this.isServiceWorkerRegistered = false;
        
        // Inicializar quando o DOM estiver carregado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    // ============================================
    // INICIALIZAÇÃO PRINCIPAL
    // ============================================
    async init() {
        console.log('🔔 Iniciando sistema de notificações push...');
        
        // 1. Obter ID do usuário da sessão
        this.userId = this.getUserId();
        console.log('👤 ID do usuário:', this.userId);
        
        // 2. Registrar Service Worker
        await this.registerServiceWorker();
        
        // 3. Conectar ao Socket.io
        this.connectToSocket();
        
        // 4. Solicitar permissão para notificações
        this.requestNotificationPermission();
        
        // 5. Configurar handlers de eventos
        this.setupEventHandlers();
        
        console.log('✅ Sistema de notificações push inicializado');
    }
    
    // ============================================
    // 1. OBTER ID DO USUÁRIO
    // ============================================
    getUserId() {
        // Tenta obter do elemento hidden na página
        const userIdElement = document.getElementById('user-id');
        if (userIdElement) {
            return userIdElement.value || 'anonymous';
        }
        
        // Tenta obter do sessionStorage
        const sessionUserId = sessionStorage.getItem('userId');
        if (sessionUserId) {
            return sessionUserId;
        }
        
        // Gera um ID temporário
        return 'temp_' + Math.random().toString(36).substr(2, 9);
    }
    
    // ============================================
    // 2. REGISTRAR SERVICE WORKER
    // ============================================
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.log('⚠️  Service Worker não suportado pelo navegador');
            return false;
        }
        
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker registrado com sucesso:', registration);
            this.isServiceWorkerRegistered = true;
            
            // Verificar se há atualizações do Service Worker
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('🔄 Nova versão do Service Worker encontrada:', newWorker);
            });
            
            return true;
        } catch (error) {
            console.error('❌ Falha ao registrar Service Worker:', error);
            return false;
        }
    }
    
    // ============================================
    // 3. CONECTAR AO SOCKET.IO
    // ============================================
    connectToSocket() {
        try {
            // Conectar ao servidor Socket.io
            this.socket = io();
            
            // Evento: Conexão estabelecida
            this.socket.on('connect', () => {
                console.log('✅ Conectado ao servidor de notificações');
                
                // Enviar ID do usuário ao servidor
                if (this.userId) {
                    this.socket.emit('user-login', this.userId);
                }
            });
            
            // Evento: Nova notificação recebida
            this.socket.on('new-notification', (notification) => {
                console.log('🔔 Nova notificação recebida via Socket:', notification);
                this.showPushNotification(notification);
                this.updateNotificationBadge();
            });
            
            // Evento: Conexão estabelecida com confirmação
            this.socket.on('connection-established', (data) => {
                console.log('🔗 Conexão de notificações confirmada:', data);
            });
            
            // Evento: Desconexão
            this.socket.on('disconnect', (reason) => {
                console.log('❌ Desconectado do servidor:', reason);
                this.showConnectionStatus(false);
            });
            
            // Evento: Reconexão
            this.socket.on('reconnect', () => {
                console.log('🔗 Reconectado ao servidor');
                this.showConnectionStatus(true);
            });
            
            // Evento: Erro
            this.socket.on('connect_error', (error) => {
                console.error('❌ Erro na conexão Socket.io:', error.message);
                this.showConnectionStatus(false);
            });
            
        } catch (error) {
            console.error('❌ Erro ao configurar Socket.io:', error);
        }
    }
    
    // ============================================
    // 4. SOLICITAR PERMISSÃO DE NOTIFICAÇÃO
    // ============================================
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('⚠️  Notificações não suportadas pelo navegador');
            return;
        }
        
        if (Notification.permission === 'granted') {
            this.notificationPermission = 'granted';
            console.log('✅ Permissão de notificações já concedida');
            return;
        }
        
        if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                this.notificationPermission = permission;
                console.log(`📱 Permissão de notificações: ${permission}`);
                
                if (permission === 'granted') {
                    this.showWelcomeNotification();
                }
            } catch (error) {
                console.error('❌ Erro ao solicitar permissão:', error);
            }
        }
    }
    
    // ============================================
    // 5. MOSTRAR NOTIFICAÇÃO PUSH
    // ============================================
    showPushNotification(notificationData) {
        if (this.notificationPermission !== 'granted') {
            console.log('⚠️  Permissão de notificações não concedida');
            return;
        }
        
        // Configuração da notificação (SEM ações)
        const options = {
            body: notificationData.mensagem || 'Nova notificação do sistema',
            icon: '/images/icon-192x192.png',
            badge: '/images/icon-192x192.png',
            tag: notificationData.id || 'demanda-notification',
            data: notificationData,
            timestamp: Date.now(),
            vibrate: [200, 100, 200]
            // REMOVA a linha: actions: []
        };
        
        // Criar e mostrar notificação
        const notification = new Notification(
            notificationData.titulo || 'Sistema Escolar',
            options
        );
        
        // Configurar clique na notificação
        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            notification.close();
            
            // Navegar para página relevante
            if (notificationData.url) {
                window.location.href = notificationData.url;
            } else if (notificationData.tipo === 'demanda') {
                window.location.href = '/demandas';
            }
        };
        
        // Fechar automaticamente após 10 segundos
        setTimeout(() => {
            notification.close();
        }, 10000);
        
        return notification;
    }
    
    // ============================================
    // 6. NOTIFICAÇÃO DE BOAS-VINDAS
    // ============================================
    showWelcomeNotification() {
        if (this.notificationPermission !== 'granted') return;
        
        const notification = new Notification('Bem-vindo ao Sistema Escolar!', {
            body: 'Você agora receberá notificações em tempo real.',
            icon: '/images/notification-icon.png',
            tag: 'welcome-notification'
        });
        
        setTimeout(() => notification.close(), 5000);
    }
    
    // ============================================
    // 7. ENVIAR NOTIFICAÇÃO PERSONALIZADA
    // ============================================
    sendNotification(toUserId, notificationData) {
        if (!this.socket || !this.socket.connected) {
            console.log('⚠️  Socket não conectado, tentando reconectar...');
            this.connectToSocket();
            return false;
        }
        
        const data = {
            userId: toUserId,
            notification: {
                id: Date.now().toString(),
                titulo: notificationData.titulo || 'Nova Notificação',
                mensagem: notificationData.mensagem || '',
                tipo: notificationData.tipo || 'info',
                url: notificationData.url || '',
                timestamp: new Date().toISOString()
            }
        };
        
        this.socket.emit('send-notification', data);
        console.log(`📤 Notificação enviada para usuário ${toUserId}`);
        
        return true;
    }
    
    // ============================================
    // 8. ATUALIZAR BADGE DE NOTIFICAÇÕES
    // ============================================
    async updateNotificationBadge() {
        try {
            // Usar a API de notificações existente
            const response = await fetch('/api/notificacoes/nao-lidas');
            if (!response.ok) throw new Error('Erro ao buscar notificações');
            
            const data = await response.json();
            const count = data.count || 0;
            
            // Atualizar badge na navbar
            const badgeElement = document.getElementById('notification-badge');
            if (badgeElement) {
                if (count > 0) {
                    badgeElement.textContent = count > 99 ? '99+' : count.toString();
                    badgeElement.style.display = 'inline-block';
                    badgeElement.classList.add('pulse');
                } else {
                    badgeElement.style.display = 'none';
                    badgeElement.classList.remove('pulse');
                }
            }
            
            // Atualizar badge da aplicação (se suportado)
            if ('setAppBadge' in navigator && count > 0) {
                navigator.setAppBadge(count).catch(console.error);
            }
            
        } catch (error) {
            console.log('⚠️  Não foi possível atualizar badge:', error.message);
        }
    }
    
    // ============================================
    // 9. MOSTRAR STATUS DA CONEXÃO
    // ============================================
    showConnectionStatus(isConnected) {
        // Criar ou atualizar elemento de status
        let statusElement = document.getElementById('connection-status');
        
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'connection-status';
            statusElement.className = 'connection-status';
            document.body.appendChild(statusElement);
        }
        
        if (isConnected) {
            statusElement.textContent = '✅ Conectado';
            statusElement.className = 'connection-status online';
            
            // Esconder após 3 segundos
            setTimeout(() => {
                statusElement.style.opacity = '0';
                setTimeout(() => {
                    if (statusElement.parentNode) {
                        statusElement.remove();
                    }
                }, 500);
            }, 3000);
        } else {
            statusElement.textContent = '❌ Offline - Reconectando...';
            statusElement.className = 'connection-status offline';
        }
    }
    
    // ============================================
    // 10. CONFIGURAR HANDLERS DE EVENTOS
    // ============================================
    setupEventHandlers() {
        // Atualizar badge periodicamente
        setInterval(() => this.updateNotificationBadge(), 30000); // A cada 30 segundos
        
        // Atualizar badge quando a página ganha foco
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateNotificationBadge();
            }
        });
        
        // Testar notificação (apenas em desenvolvimento)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            window.testPushNotification = () => {
                this.sendNotification(this.userId, {
                    titulo: 'Teste de Notificação Push',
                    mensagem: 'Esta é uma notificação de teste do sistema de notificações em tempo real! 🚀',
                    tipo: 'success',
                    url: '/demandas'
                });
                
                // Mostrar toast de confirmação
                if (typeof NotificationSystem !== 'undefined') {
                    NotificationSystem.showToast('success', 'Notificação de teste enviada!');
                }
            };
            
            console.log('🧪 Modo desenvolvimento: Use testPushNotification() para testar');
        }
        
        // Integrar com sistema de notificações existente
        this.integrateWithExistingSystem();
    }
    
    // ============================================
    // 11. INTEGRAR COM SISTEMA EXISTENTE
    // ============================================
    integrateWithExistingSystem() {
        // Verificar se o sistema de notificações existe
        if (typeof NotificationSystem !== 'undefined') {
            console.log('🔗 Integrando com sistema de notificações existente...');
            
            // Sobrescrever função de mostrar notificação para usar push também
            const originalShowToast = NotificationSystem.showToast;
            
            NotificationSystem.showToast = function(tipo, mensagem, titulo = null) {
                // Chamar a função original (SE existir)
                if (originalShowToast && typeof originalShowToast === 'function') {
                    originalShowToast.call(this, tipo, mensagem, titulo);
                } else {
                    // Fallback: mostrar notificação básica
                    console.log('📢 Mostrando notificação:', {tipo, mensagem, titulo});
                }
                
                // Enviar notificação push para o próprio usuário
                if (window.PushNotifications && window.PushNotifications.notificationPermission === 'granted') {
                    window.PushNotifications.sendNotification(window.PushNotifications.userId, {
                        titulo: titulo || (tipo === 'success' ? 'Sucesso!' : tipo === 'error' ? 'Erro!' : 'Notificação'),
                        mensagem: mensagem,
                        tipo: tipo,
                        url: window.location.pathname
                    });
                }
            };
            
            console.log('✅ Integração com sistema de notificações concluída');
        }
    }
    
    // ============================================
    // 12. UTILIDADES
    // ============================================
    isConnected() {
        return this.socket && this.socket.connected;
    }
    
    getConnectionStatus() {
        if (!this.socket) return 'Desconectado';
        return this.socket.connected ? 'Conectado' : 'Desconectado';
    }
}

// ============================================
// INICIAR O SISTEMA GLOBALMENTE
// ============================================

// Criar instância global
window.PushNotifications = new PushNotificationSystem();

// Exportar para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PushNotificationSystem;
}