// src/routes/debug.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Demanda = require('../models/Demanda');
const cron = require('node-cron');
const moment = require('moment-timezone');

// 📊 PÁGINA DE DIAGNÓSTICO DO AGENDADOR
router.get('/agendador', async (req, res) => {
    try {
        console.log('🔍 ACESSANDO PÁGINA DE DIAGNÓSTICO DO AGENDADOR');
        
        // 1. VERIFICAR STATUS DO BANCO DE DADOS
        const dbStatus = mongoose.connection.readyState;
        const dbStatusText = {
            0: '❌ DESCONECTADO',
            1: '✅ CONECTADO',
            2: '⚠️ CONECTANDO...',
            3: '⚠️ DESCONECTANDO...'
        }[dbStatus] || '❓ DESCONHECIDO';

        // 2. CONTAR TOTAL DE DEMANDAS
        const totalDemandas = await Demanda.countDocuments();
        
        // 3. BUSCAR DEMANDAS COM PRAZOS PRÓXIMOS (TESTE DIRETO)
        const hoje = moment().tz('America/Sao_Paulo').startOf('day').toDate();
        const tresDias = moment().tz('America/Sao_Paulo').add(3, 'days').endOf('day').toDate();
        
        console.log('📅 DATAS DE TESTE:');
        console.log(`   Hoje: ${moment(hoje).format('DD/MM/YYYY HH:mm')}`);
        console.log(`   +3 dias: ${moment(tresDias).format('DD/MM/YYYY HH:mm')}`);

        const demandasComPrazo = await Demanda.find({
            prazoConclusao: {
                $gte: hoje,
                $lte: tresDias
            },
            status: { $nin: ['Concluído', 'Cancelado'] }
        }).select('titulo prazoConclusao status criadorEmail responsavelEmail escola').lean();

        // 4. VERIFICAR DEMANDAS QUE VENCEM HOJE
        const amanha = moment().tz('America/Sao_Paulo').add(1, 'days').endOf('day').toDate();
        const hojeInicio = moment().tz('America/Sao_Paulo').startOf('day').toDate();
        
        const demandasHoje = await Demanda.find({
            prazoConclusao: {
                $gte: hojeInicio,
                $lte: amanha
            },
            status: { $nin: ['Concluído', 'Cancelado'] }
        }).select('titulo prazoConclusao status').lean();

        // 5. LISTAR TODAS AS DEMANDAS (PARA DEBUG)
        const todasDemandas = await Demanda.find()
            .select('titulo prazoConclusao status criadorEmail responsavelEmail')
            .sort({ prazoConclusao: 1 })
            .limit(10)
            .lean();

        // 6. CALCULAR DIAS PARA VENCIMENTO
        const demandasComDias = demandasComPrazo.map(d => {
            const prazo = moment(d.prazoConclusao);
            const hojeMoment = moment();
            const diasRestantes = prazo.diff(hojeMoment, 'days');
            
            return {
                ...d,
                diasRestantes,
                prazoFormatado: moment(d.prazoConclusao).format('DD/MM/YYYY'),
                hojeFormatado: hojeMoment.format('DD/MM/YYYY HH:mm')
            };
        });

        // 7. LOGS DO SERVIDOR (ÚLTIMOS 20)
        const logsServidor = [
            `[${moment().format('HH:mm:ss')}] Página de diagnóstico acessada`,
            `[${moment().subtract(5, 'minutes').format('HH:mm:ss')}] Agendador executado (se estiver rodando)`,
            `[${moment().subtract(1, 'hour').format('HH:mm:ss')}] Sistema iniciado`
        ];

        // 8. INFORMACÕES DO SISTEMA
        const infoSistema = {
            horaServidor: moment().format('DD/MM/YYYY HH:mm:ss'),
            timezone: moment.tz.guess(),
            timezoneBRT: 'America/Sao_Paulo',
            nodeVersion: process.version,
            platform: process.platform,
            memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        };

        res.render('debug-agendador', {
        title: 'Diagnóstico do Agendador',
        // ADICIONE ESTA LINHA:
        user: null,
        currentPage: 'diagnostico',
        dbStatus: dbStatusText,
        totalDemandas,
        demandasComPrazo: demandasComDias,
        demandasHoje,
        todasDemandas,
        logs: logsServidor,
        infoSistema,
        moment: moment
    });

    } catch (error) {
        console.error('❌ ERRO NO DIAGNÓSTICO:', error);
        res.status(500).send(`Erro no diagnóstico: ${error.message}`);
    }
});

// 🔧 ROTA API PARA TESTE DIRETO DO AGENDADOR
router.get('/api/teste-agendador', async (req, res) => {
    try {
        console.log('🧪 EXECUTANDO TESTE MANUAL DO AGENDADOR');
        
        // Simular a lógica do agendador
        const AgendadorNotificacoes = require('../models/scheduler');
        const agendador = new AgendadorNotificacoes();
        
        // Executar manualmente
        const resultado = await agendador.verificarPrazosProximos();
        
        res.json({
            success: true,
            message: 'Teste do agendador executado manualmente',
            resultado: resultado,
            timestamp: new Date().toISOString(),
            timezone: 'America/Sao_Paulo'
        });
        
    } catch (error) {
        console.error('❌ ERRO NO TESTE MANUAL:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 📊 ROTA API PARA DADOS CRUS DO BANCO
router.get('/api/demandas', async (req, res) => {
    try {
        const { dias = 3 } = req.query;
        
        const hoje = new Date();
        const dataLimite = new Date();
        dataLimite.setDate(hoje.getDate() + parseInt(dias));
        
        // Busca exata que o agendador deve fazer
        const query = {
            prazoConclusao: {
                $gte: hoje,
                $lte: dataLimite
            },
            status: { $nin: ['Concluído', 'Cancelado'] }
        };
        
        const demandas = await Demanda.find(query)
            .select('_id titulo prazoConclusao status criadorEmail responsavelEmail escola')
            .sort({ prazoConclusao: 1 })
            .lean();
            
        console.log(`🔍 QUERY EXECUTADA:`, query);
        console.log(`📊 RESULTADOS: ${demandas.length} demandas encontradas`);
        
        res.json({
            query,
            total: demandas.length,
            demandas: demandas.map(d => ({
                ...d,
                prazoConclusao: d.prazoConclusao,
                prazoFormatado: moment(d.prazoConclusao).format('DD/MM/YYYY HH:mm'),
                diasRestantes: Math.ceil((new Date(d.prazoConclusao) - hoje) / (1000 * 60 * 60 * 24))
            })),
            info: {
                hoje: hoje.toISOString(),
                dataLimite: dataLimite.toISOString(),
                diasParametro: dias
            }
        });
        
    } catch (error) {
        console.error('❌ ERRO NA CONSULTA:', error);
        res.status(500).json({ error: error.message });
    }
});

// ⚙️ ROTA PARA VER CONFIGURAÇÃO DO CRON
router.get('/api/cron', (req, res) => {
    try {
        // Verificar se o cron está rodando
        const cronJobs = require('../models/scheduler');
        const agendador = new cronJobs.AgendadorNotificacoes();
        
        res.json({
            cronConfigurado: agendador.cronJob ? '✅ SIM' : '❌ NÃO',
            expressaoCron: '0 10 * * *', // Diariamente às 10h
            descricao: 'Todo dia às 10:00 (horário do servidor)',
            proximaExecucao: agendador.cronJob ? 'Ver logs do servidor' : 'Não configurado',
            timezone: 'America/Sao_Paulo (BRT)',
            status: agendador.cronJob ? 'ATIVO' : 'INATIVO'
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rota para ver todas as notificações do sistema
router.get('/api/notificacoes', async (req, res) => {
    try {
        console.log('🔍 Buscando todas as notificações do sistema...');
        
        const Notificacao = mongoose.models.Notificacao;
        if (!Notificacao) {
            return res.status(500).json({
                success: false,
                message: 'Modelo Notificacao não encontrado'
            });
        }
        
        // Buscar todas as notificações (últimas 50)
        const notificacoes = await Notificacao.find({})
            .sort({ dataCriacao: -1 })
            .limit(50)
            .lean();
        
        console.log(`📊 Encontradas ${notificacoes.length} notificações`);
        
        // Contar por tipo
        const contagemPorTipo = {};
        notificacoes.forEach(n => {
            contagemPorTipo[n.tipo] = (contagemPorTipo[n.tipo] || 0) + 1;
        });
        
        res.json({
            success: true,
            total: notificacoes.length,
            contagemPorTipo: contagemPorTipo,
            notificacoes: notificacoes,
            timestamp: new Date(),
            timezone: 'America/Sao_Paulo'
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar notificações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar notificações',
            error: error.message
        });
    }
});

// Rota para criar notificação de teste
router.post('/api/criar-notificacao-teste', async (req, res) => {

    try {
        console.log('🧪 Criando notificação de teste...');
        
        const { userId, titulo, mensagem, tipo = 'info' } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'ID do usuário é obrigatório'
            });
        }
        
        // Verificar se o modelo Notificacao existe
        const Notificacao = mongoose.models.Notificacao;
        if (!Notificacao) {
            return res.status(500).json({
                success: false,
                message: 'Modelo Notificacao não encontrado'
            });
        }
        
        // Criar notificação
        const notificacao = new Notificacao({
            usuarioId: userId,
            titulo: titulo || 'Notificação de Teste',
            mensagem: mensagem || 'Esta é uma notificação de teste criada manualmente',
            tipo: tipo,
            link: '/dashboard',
            lida: false,
            dataCriacao: new Date()
        });
        
        await notificacao.save();
        
        console.log(`✅ Notificação de teste criada: ${notificacao._id}`);
        
        // Enviar via Socket.io
        if (req.io) {
            req.io.to(userId).emit('nova-notificacao', {
                id: notificacao._id,
                titulo: notificacao.titulo,
                mensagem: notificacao.mensagem,
                tipo: notificacao.tipo,
                lida: notificacao.lida,
                dataCriacao: notificacao.dataCriacao
            });
        }
        
        res.json({
            success: true,
            message: 'Notificação de teste criada com sucesso',
            notificacao: notificacao
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar notificação de teste:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar notificação',
            error: error.message
        });
    }
});
module.exports = router;