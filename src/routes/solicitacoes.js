// src/routes/solicitacoes.js
const express = require('express');
const router = express.Router();
const SolicitacaoCadastro = require('../models/SolicitacaoCadastro');
const { User, escolasLista } = require('../models/User');
const emailService = require('../config/email');
const senhaHelper = require('../utils/senhaHelper');

// ============================================
// ROTAS PÚBLICAS (acesso sem login)
// ============================================

// Página de solicitação de cadastro
router.get('/solicitar-cadastro', (req, res) => {
    try {
        res.render('solicitar-cadastro', {
            title: 'Solicitar Cadastro',
            escolas: escolasLista,
            user: null,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Erro ao carregar página de solicitação:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar página de solicitação',
            error: error.message
        });
    }
});

// ============================================
// ROTAS ADMINISTRATIVAS (requer autenticação)
// ============================================

// Middleware para verificar se é admin
const verificarAdmin = async (req, res, next) => {
    try {
        if (!req.session.userId) {
            return res.redirect('/login');
        }
        
        const usuario = await User.findById(req.session.userId);
        
        if (!usuario || usuario.tipo !== 'administrador') {
            return res.status(403).json({
                success: false,
                message: 'Acesso restrito a administradores'
            });
        }
        
        req.user = usuario;
        next();
    } catch (error) {
        console.error('Erro ao verificar admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno'
        });
    }
};

// Página de gerenciamento de solicitações (admin)
router.get('/admin/solicitacoes', verificarAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        
        // Construir filtro
        const filtro = {};
        if (status && status !== 'todos') {
            filtro.status = status;
        }
        
        // Calcular paginação
        const pagina = parseInt(page);
        const limite = parseInt(limit);
        const skip = (pagina - 1) * limite;
        
        // Buscar solicitações
        const [solicitacoes, total] = await Promise.all([
            SolicitacaoCadastro.find(filtro)
                .sort({ dataSolicitacao: -1 })
                .skip(skip)
                .limit(limite)
                .populate('processadoPor', 'nome email')
                .populate('usuarioCriado', 'nome email'),
            
            SolicitacaoCadastro.countDocuments(filtro)
        ]);
        
        // Calcular totais por status
        const totais = await SolicitacaoCadastro.aggregate([
            {
                $group: {
                    _id: '$status',
                    total: { $sum: 1 }
                }
            }
        ]);
        
        const totaisPorStatus = {
            pendente: 0,
            aprovada: 0,
            rejeitada: 0,
            expirada: 0
        };
        
        totais.forEach(item => {
            totaisPorStatus[item._id] = item.total;
        });
        
        res.render('admin/solicitacoes', {
            title: 'Gerenciar Solicitações',
            solicitacoes,
            totais: totaisPorStatus,
            statusAtual: status || 'todos',
            paginacao: {
                pagina,
                limite,
                total,
                paginas: Math.ceil(total / limite)
            },
            user: req.user
        });
        
    } catch (error) {
        console.error('Erro ao carregar solicitações:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar solicitações',
            error: error.message
        });
    }
});

// API: Aprovar solicitação
router.post('/admin/solicitacoes/:id/aprovar', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { tipo, departamento, escolas } = req.body;
        
        // Buscar solicitação
        const solicitacao = await SolicitacaoCadastro.findById(id);
        
        if (!solicitacao) {
            return res.status(404).json({
                success: false,
                message: 'Solicitação não encontrada'
            });
        }
        
        if (solicitacao.status !== 'pendente') {
            return res.status(400).json({
                success: false,
                message: 'Solicitação já processada'
            });
        }
        
        // Verificar se email já está cadastrado
        const usuarioExistente = await User.findOne({ email: solicitacao.email });
        if (usuarioExistente) {
            return res.status(400).json({
                success: false,
                message: 'Email já cadastrado no sistema'
            });
        }
        
        // Gerar senha temporária
        const senhaTemporaria = senhaHelper.gerarSenhaTemporaria();
        
        // Criar novo usuário
        const novoUsuario = new User({
            nome: solicitacao.nome,
            email: solicitacao.email,
            senha: senhaTemporaria, // Será criptografada no pre-save
            tipo: tipo || 'comum',
            departamento: departamento || solicitacao.departamento,
            escolas: escolas ? [escolas] : [solicitacao.escola],
            ativo: true,
            primeiroAcesso: true,
            solicitacaoOrigem: solicitacao._id,
            dataAprovacao: new Date(),
            aprovadoPor: req.user._id,
            senhaTemporaria: senhaTemporaria // Armazenar em texto claro para email
        });
        
        // Salvar usuário
        await novoUsuario.save();
        
        console.log('✅ Usuário criado:', novoUsuario.email);
        
        // Atualizar solicitação
        solicitacao.status = 'aprovada';
        solicitacao.processadoPor = req.user._id;
        solicitacao.dataProcessamento = new Date();
        solicitacao.usuarioCriado = novoUsuario._id;
        solicitacao.notificadoUsuario = false;
        
        await solicitacao.save();
        
        // Enviar email de aprovação
        try {
            await emailService.enviarAprovacaoCadastro(novoUsuario, senhaTemporaria);
            solicitacao.notificadoUsuario = true;
            await solicitacao.save();
        } catch (emailError) {
            console.warn('⚠️ Email de aprovação não enviado:', emailError.message);
            // Continua mesmo sem email
        }
        
        // Criar notificação no sistema
        if (req.io) {
            // Notificar admin sobre sucesso
            req.io.to(`user_${req.user._id}`).emit('notificacao', {
                titulo: 'Solicitação Aprovada',
                mensagem: `Usuário ${solicitacao.nome} cadastrado com sucesso`,
                tipo: 'success',
                data: new Date()
            });
        }
        
        res.json({
            success: true,
            message: 'Solicitação aprovada e usuário cadastrado com sucesso',
            usuario: {
                id: novoUsuario._id,
                nome: novoUsuario.nome,
                email: novoUsuario.email
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao aprovar solicitação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao aprovar solicitação',
            error: error.message
        });
    }
});

// API: Rejeitar solicitação
router.post('/admin/solicitacoes/:id/rejeitar', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        
        if (!motivo || motivo.trim().length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Motivo da rejeição é obrigatório (mínimo 5 caracteres)'
            });
        }
        
        // Buscar solicitação
        const solicitacao = await SolicitacaoCadastro.findById(id);
        
        if (!solicitacao) {
            return res.status(404).json({
                success: false,
                message: 'Solicitação não encontrada'
            });
        }
        
        if (solicitacao.status !== 'pendente') {
            return res.status(400).json({
                success: false,
                message: 'Solicitação já processada'
            });
        }
        
        // Atualizar solicitação
        solicitacao.status = 'rejeitada';
        solicitacao.processadoPor = req.user._id;
        solicitacao.dataProcessamento = new Date();
        solicitacao.motivoRejeicao = motivo.trim();
        solicitacao.notificadoUsuario = false;
        
        await solicitacao.save();
        
        // Enviar email de rejeição
        try {
            await emailService.enviarRejeicaoCadastro(solicitacao, motivo);
            solicitacao.notificadoUsuario = true;
            await solicitacao.save();
        } catch (emailError) {
            console.warn('⚠️ Email de rejeição não enviado:', emailError.message);
            // Continua mesmo sem email
        }
        
        // Criar notificação no sistema
        if (req.io) {
            req.io.to(`user_${req.user._id}`).emit('notificacao', {
                titulo: 'Solicitação Rejeitada',
                mensagem: `Solicitação de ${solicitacao.nome} rejeitada`,
                tipo: 'warning',
                data: new Date()
            });
        }
        
        res.json({
            success: true,
            message: 'Solicitação rejeitada com sucesso'
        });
        
    } catch (error) {
        console.error('❌ Erro ao rejeitar solicitação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao rejeitar solicitação',
            error: error.message
        });
    }
});

// API: Detalhes da solicitação
router.get('/admin/solicitacoes/:id', verificarAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const solicitacao = await SolicitacaoCadastro.findById(id)
            .populate('processadoPor', 'nome email')
            .populate('usuarioCriado', 'nome email ativo');
        
        if (!solicitacao) {
            return res.status(404).json({
                success: false,
                message: 'Solicitação não encontrada'
            });
        }
        
        res.json({
            success: true,
            solicitacao
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar solicitação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno',
            error: error.message
        });
    }
});

// ============================================
// ROTA DE TESTE DO EMAIL
// ============================================

router.get('/testar-email', async (req, res) => {
    try {
        console.log('🧪 Testando serviço de email...');
        
        // Testar conexão
        const conexao = await emailService.testarConexao();
        
        // Criar dados de teste
        const solicitacaoTeste = {
            nome: 'João Silva (Teste)',
            email: 'teste@exemplo.com',
            telefone: '(27) 99999-9999',
            funcao: 'Professor',
            departamento: 'pedagogico',
            escola: 'EEEFM Domingos Perim',
            justificativa: 'Este é um teste do sistema de email',
            dataSolicitacao: new Date()
        };
        
        // Testar envio
        const resultado = await emailService.enviarNotificacaoNovaSolicitacao(solicitacaoTeste);
        
        res.json({
            success: true,
            message: 'Teste de email realizado',
            conexao: conexao ? '✅ Configurado' : '🔧 Modo Simulação',
            envio: resultado.simulacao ? '📧 Simulado' : '📧 Enviado Realmente',
            resultado
        });
        
    } catch (error) {
        console.error('❌ Erro no teste de email:', error);
        res.status(500).json({
            success: false,
            message: 'Erro no teste de email',
            error: error.message
        });
    }
});

module.exports = router;