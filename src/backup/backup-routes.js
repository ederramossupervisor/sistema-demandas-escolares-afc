// src/backup/backup-routes.js
const express = require('express');
const router = express.Router();
const BackupAdmin = require('./backup-admin');
const backupAdmin = new BackupAdmin();

// Middleware de log para todas as rotas de backup
router.use((req, res, next) => {
    console.log('📝 Backup Route Access:', {
        path: req.path,
        method: req.method,
        user: req.session.user ? req.session.user.email : 'Não logado',
        tipo: req.session.user ? req.session.user.tipo : 'N/A',
        time: new Date().toISOString()
    });
    next();
});

// Middleware para verificar se é administrador - VERSÃO TEMPORÁRIA
const verificarAdmin = (req, res, next) => {
    console.log('⚠️  VERIFICAÇÃO ADMIN DESATIVADA TEMPORARIAMENTE');
    console.log('Usuário na sessão:', req.session.user);
    
    // TEMPORARIAMENTE: Permitir acesso a todos para testar
    // Depois reative esta verificação
    next();
    
    /*
    // CÓDIGO ORIGINAL (mantenha comentado por enquanto)
    if (req.session.user && req.session.user.tipo === 'administrador') {
        next();
    } else {
        res.status(403).json({ 
            success: false, 
            message: 'Acesso negado. Somente administradores podem gerenciar backups.' 
        });
    }
    */
};
// ROTA DE TESTE - Verificar sessão
router.get('/teste-sessao', (req, res) => {
    res.json({
        success: true,
        session: req.session,
        user: req.session.user,
        isAdmin: req.session.user && req.session.user.tipo === 'administrador',
        headers: req.headers
    });
});

// Rota para listar backups (apenas admin)
router.get('/listar', verificarAdmin, async (req, res) => {
    try {
        const backups = await backupAdmin.listBackups();
        const stats = await backupAdmin.getBackupStats();
        
        res.json({
            success: true,
            backups: backups,
            estatisticas: stats
        });
    } catch (error) {
        console.error('Erro ao listar backups:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao listar backups',
            error: error.message 
        });
    }
});

// Rota para executar backup manual (apenas admin)
router.post('/executar-manual', verificarAdmin, async (req, res) => {
    try {
        const resultado = await backupAdmin.executeManualBackup();
        res.json(resultado);
    } catch (error) {
        console.error('Erro ao executar backup manual:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao executar backup manual',
            error: error.message 
        });
    }
});

// Rota para excluir backup (apenas admin)
router.delete('/excluir/:tipo/:arquivo', verificarAdmin, async (req, res) => {
    try {
        const { tipo, arquivo } = req.params;
        
        // Validar tipo
        const tiposValidos = ['database', 'reports', 'logs'];
        if (!tiposValidos.includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de backup inválido'
            });
        }

        const resultado = await backupAdmin.deleteBackup(tipo, arquivo);
        res.json(resultado);
    } catch (error) {
        console.error('Erro ao excluir backup:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao excluir backup',
            error: error.message 
        });
    }
});

// Rota para obter estatísticas (apenas admin)
router.get('/estatisticas', verificarAdmin, async (req, res) => {
    try {
        const stats = await backupAdmin.getBackupStats();
        res.json({
            success: true,
            estatisticas: stats
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao obter estatísticas',
            error: error.message 
        });
    }
});

// Rota para verificar status do backup (público - apenas status básico)
router.get('/status', async (req, res) => {
    try {
        const stats = await backupAdmin.getBackupStats();
        
        // Informações básicas para usuários não-admin
        const statusPublico = {
            sistemaBackup: 'ativo',
            ultimoBackup: stats.ultimoBackup ? stats.ultimoBackup.dataCriacao : null,
            totalBackups: stats.totalBackups
        };
        
        res.json({
            success: true,
            status: statusPublico
        });
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao verificar status do backup'
        });
    }
});
// ROTA PARA PÁGINA HTML (ADICIONE ESTA)
router.get('/painel', verificarAdmin, (req, res) => {
    // Verifique o caminho correto da sua view
    res.render('admin/backup', {
        title: 'Gerenciamento de Backups',
        user: req.session.user
    });
});

// ROTA PARA DOWNLOAD (ADICIONE ESTA)
router.get('/download/:tipo/:arquivo', verificarAdmin, async (req, res) => {
    try {
        const { tipo, arquivo } = req.params;
        
        // Validação básica
        if (!['database', 'reports', 'logs'].includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de backup inválido'
            });
        }

        // Construir caminho do arquivo
        const path = require('path');
        const backupDir = path.join(__dirname, '..', '..', 'backups', tipo);
        const filePath = path.join(backupDir, arquivo);

        // Verificar se arquivo existe
        const fs = require('fs').promises;
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado'
            });
        }

        // Enviar arquivo para download
        res.download(filePath, arquivo);
    } catch (error) {
        console.error('Erro ao fazer download:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao fazer download do arquivo'
        });
    }
});
// ROTA PARA PÁGINA ADMIN DE BACKUPS
router.get('/painel', verificarAdmin, (req, res) => {
    try {
        // Renderizar a página de backups
        res.render('admin/backup', {
            title: 'Gerenciamento de Backups',
            user: req.session.user,
            currentPage: 'admin-backups'
        });
    } catch (error) {
        console.error('Erro ao renderizar painel de backups:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar painel de backups'
        });
    }
});

// ROTA PARA DOWNLOAD DE BACKUP
router.get('/download/:tipo/:arquivo', verificarAdmin, async (req, res) => {
    try {
        const { tipo, arquivo } = req.params;
        
        // Validar tipo
        if (!['database', 'reports', 'logs'].includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de backup inválido'
            });
        }

        // Construir caminho do arquivo
        const path = require('path');
        const fs = require('fs').promises;
        
        // Ajuste o caminho conforme sua estrutura
        const backupDir = path.join(__dirname, '..', '..', 'backups', tipo);
        const filePath = path.join(backupDir, arquivo);

        // Verificar se arquivo existe
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({
                success: false,
                message: 'Arquivo não encontrado'
            });
        }

        // Enviar arquivo para download
        res.download(filePath, arquivo);
    } catch (error) {
        console.error('Erro ao fazer download:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao fazer download do arquivo'
        });
    }
});

// ROTA SIMPLIFICADA PARA PÁGINA DE BACKUPS
router.get('/pagina', async (req, res) => {
    console.log('📄 Renderizando página de backups...');
    
    try {
        // Se tiver usuário na sessão, use-o
        const usuario = req.session.user || {
            _id: 'teste123',
            nome: 'Administrador Teste',
            email: 'admin@teste.com',
            tipo: 'administrador',
            escola: 'Escola Teste'
        };
        
        // Buscar total de demandas (para o footer)
        let totalDemandas = 0;
        try {
            // Se você tem um modelo Demandas, use:
            // const Demandas = require('../models/Demanda');
            // totalDemandas = await Demandas.countDocuments();
            totalDemandas = 0; // Temporariamente 0
        } catch (err) {
            console.log('Não foi possível contar demandas:', err.message);
            totalDemandas = 0;
        }
        
        res.render('admin/backup', {
            title: 'Gerenciamento de Backups',
            user: usuario,
            totalDemandas: totalDemandas, // ← ESSA VARIÁVEL É IMPORTANTE!
            currentPage: 'admin-backups'
        });
        
    } catch (error) {
        console.error('Erro ao renderizar página de backups:', error);
        res.status(500).send('Erro ao carregar página de backups');
    }
});

module.exports = router;