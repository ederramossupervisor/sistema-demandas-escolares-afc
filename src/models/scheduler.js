// src/models/scheduler.js - VERSÃO CORRIGIDA
const cron = require('node-cron');
const mongoose = require('mongoose');

class AgendadorNotificacoes {
    constructor() {
        console.log('⏰ Inicializando Agendador de Notificações...');
        
        // Obter modelos JÁ definidos no Mongoose
        // Usar o mongoose global, não redefinir modelos
        this.Demanda = mongoose.models.Demanda;
        this.Notificacao = mongoose.models.Notificacao;
        this.User = mongoose.models.User;
        
        console.log('✅ Modelos carregados do Mongoose para o agendador');
        
        if (!this.Demanda || !this.Notificacao || !this.User) {
            console.warn('⚠️ Modelos não encontrados no Mongoose. Tentando importar...');
            
            // Tentar importar como fallback (evitando cache circular)
            try {
                this.Demanda = require('./Demanda');
                this.Notificacao = require('./Notificacao');
                this.User = require('./User');
                console.log('✅ Modelos importados manualmente');
            } catch (error) {
                console.error('❌ Erro ao importar modelos:', error.message);
                return;
            }
        }
        
        // Configurar o cron job para rodar diariamente às 10h BRT
        try {
            this.cronJob = cron.schedule('0 10 * * *', async () => {
                console.log('⏰ AGENDADOR EXECUTANDO: Tarefa agendada às 10h BRT');
                await this.verificarPrazosProximos();
            }, {
                scheduled: true,
                timezone: "America/Sao_Paulo"
            });
            
            console.log('📅 Agendador configurado (todos os dias às 10h BRT)');
        } catch (error) {
            console.error('❌ Erro ao configurar cron job:', error);
        }
    }

    async verificarPrazosProximos() {
        try {
            console.log('⏰ AGENDADOR EXECUTANDO: Verificando prazos próximos...');
            console.log(`📅 Hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
            
            const moment = require('moment-timezone');
            const agora = moment().tz('America/Sao_Paulo');
            const hoje = agora.startOf('day').toDate();
            const tresDias = agora.clone().add(3, 'days').endOf('day').toDate();
            
            console.log('🔍 DATAS DE BUSCA:');
            console.log(`   Hoje (início): ${moment(hoje).format('DD/MM/YYYY HH:mm')}`);
            console.log(`   +3 dias (fim): ${moment(tresDias).format('DD/MM/YYYY HH:mm')}`);
            
            // Verificar se o modelo Demanda existe
            if (!this.Demanda) {
                console.error('❌ Modelo Demanda não disponível no agendador');
                return { encontradas: 0, notificacoes: 0, erro: 'Modelo não disponível' };
            }
            
            // Buscar demandas
            const demandas = await this.Demanda.find({
                prazo: {
                    $gte: hoje,
                    $lte: tresDias
                },
                status: { $nin: ['concluida', 'cancelada'] }
            }).populate('criadoPor.id').populate('responsavel.id');
            
            console.log(`📊 RESULTADO DA BUSCA: ${demandas.length} demanda(s) encontrada(s)`);
            
            if (demandas.length === 0) {
                console.log('ℹ️ Nenhuma demanda com prazo próximo encontrada.');
                return { encontradas: 0, notificacoes: 0 };
            }
            
            // Log detalhado de cada demanda encontrada
            demandas.forEach(demanda => {
                const prazo = moment(demanda.prazo);
                const diasRestantes = prazo.diff(agora, 'days');
                
                console.log(`   📋 "${demanda.titulo}"`);
                console.log(`      Prazo: ${prazo.format('DD/MM/YYYY')}`);
                console.log(`      Dias restantes: ${diasRestantes}`);
                console.log(`      Criador: ${demanda.criadoPor?.nome || demanda.criadoPor?.email || 'Desconhecido'}`);
                console.log(`      Responsável: ${demanda.responsavel?.nome || demanda.responsavel?.email || 'Não atribuído'}`);
            });
            
            let totalNotificacoes = 0;
            
            // Processar cada demanda
            for (const demanda of demandas) {
                const notificacoesGeradas = await this.enviarNotificacoesPrazo(demanda);
                totalNotificacoes += notificacoesGeradas;
            }
            
            console.log(`✅ AGENDADOR FINALIZADO: ${totalNotificacoes} notificação(ões) enviada(s) para ${demandas.length} demanda(s)`);
            console.log('⏰ Próxima execução: Amanhã às 10:00 BRT\n');
            
            return { 
                encontradas: demandas.length, 
                notificacoes: totalNotificacoes,
                demandas: demandas.map(d => ({
                    id: d._id,
                    titulo: d.titulo,
                    prazo: d.prazo
                }))
            };
            
        } catch (error) {
            console.error('❌ ERRO NO AGENDADOR:', error);
            console.error('Stack trace:', error.stack);
            return { error: error.message, encontradas: 0, notificacoes: 0 };
        }
    }

    async enviarNotificacoesPrazo(demanda) {
        try {
            const moment = require('moment-timezone');
            const agora = moment().tz('America/Sao_Paulo');
            const prazo = moment(demanda.prazo);
            const diasRestantes = prazo.diff(agora, 'days');
            
            let mensagem = '';
            let tipo = '';
            
            if (diasRestantes === 0) {
                mensagem = `⚠️ URGENTE: A demanda "${demanda.titulo}" vence HOJE!`;
                tipo = 'urgente';
            } else if (diasRestantes === 1) {
                mensagem = `⏰ ATENÇÃO: A demanda "${demanda.titulo}" vence AMANHÃ!`;
                tipo = 'alerta';
            } else {
                mensagem = `📅 Lembrete: A demanda "${demanda.titulo}" vence em ${diasRestantes} dias`;
                tipo = 'lembrete';
            }
            
            // Usuários para notificar
            const usuariosParaNotificar = new Set();
            
            // 1. Criador da demanda
            if (demanda.criadoPor && demanda.criadoPor.id) {
                // Verificar se é objeto populado ou apenas ID
                const criadorId = demanda.criadoPor.id._id 
                    ? demanda.criadoPor.id._id.toString() 
                    : demanda.criadoPor.id.toString();
                usuariosParaNotificar.add(criadorId);
            }
            
            // 2. Responsável pela demanda
            if (demanda.responsavel && demanda.responsavel.id) {
                // Verificar se é objeto populado ou apenas ID
                const responsavelId = demanda.responsavel.id._id 
                    ? demanda.responsavel.id._id.toString() 
                    : demanda.responsavel.id.toString();
                usuariosParaNotificar.add(responsavelId);
            }
            
            // Verificar se o modelo User existe
            if (!this.User) {
                console.error('❌ Modelo User não disponível no agendador');
                return 0;
            }
            
            // 3. Buscar diretores e supervisores
            const diretores = await this.User.find({ tipo: 'diretor' }).select('_id');
            const supervisores = await this.User.find({ tipo: 'supervisor' }).select('_id');
            
            diretores.forEach(dir => usuariosParaNotificar.add(dir._id.toString()));
            supervisores.forEach(sup => usuariosParaNotificar.add(sup._id.toString()));
            
            let notificacoesCriadas = 0;
            
            // Verificar se o modelo Notificacao existe
            if (!this.Notificacao) {
                console.error('❌ Modelo Notificacao não disponível no agendador');
                return 0;
            }
            
            console.log(`   👥 Usuários para notificar: ${usuariosParaNotificar.size}`);
            console.log(`   📋 IDs dos usuários: ${Array.from(usuariosParaNotificar).join(', ') || 'Nenhum usuário encontrado'}`);
            
            // Criar notificações para cada usuário
            for (const userId of usuariosParaNotificar) {
                // Mapear nossos tipos para os tipos válidos do modelo
                const tipoMapeado = {
                    'urgente': 'error',      // urgente → error (vermelho)
                    'alerta': 'warning',     // alerta → warning (amarelo/laranja)
                    'lembrete': 'info'       // lembrete → info (azul)
                }[tipo] || 'info';  // Fallback para 'info' se não encontrar
                
                console.log(`      🎯 Mapeando tipo: ${tipo} → ${tipoMapeado}`);
                
                const notificacao = new this.Notificacao({
                    usuarioId: userId,  // ✅ CORRETO: usuarioId (não usuario)
                    titulo: 'Prazo de Demanda Próximo',
                    mensagem: mensagem,
                    tipo: tipoMapeado,  // ✅ CORRETO: usar tipo mapeado
                    link: `/demandas/${demanda._id}`,
                    lida: false,
                    dataCriacao: new Date()
                });
                
                await notificacao.save();
                notificacoesCriadas++;
                
                console.log(`   📨 Notificação criada para usuário: ${userId}`);
                console.log(`      ✅ Notificação ${notificacoesCriadas}: ID ${notificacao._id} criada com sucesso!`);
            }
            
            return notificacoesCriadas;
            
        } catch (error) {
            console.error(`❌ Erro ao enviar notificações para demanda ${demanda._id}:`, error);
            return 0;
        }
    }
    
    // Método para parar o agendador
    parar() {
        if (this.cronJob) {
            this.cronJob.stop();
            console.log('⏰ Agendador parado');
        }
    }
    
    // Método para verificar status
    status() {
        return {
            ativo: this.cronJob ? true : false,
            proximaExecucao: this.cronJob ? '10:00 BRT (diário)' : 'Não configurado',
            timezone: 'America/Sao_Paulo'
        };
    }
    
    // Método para teste manual
    async executarTeste() {
        console.log('🧪 EXECUTANDO TESTE MANUAL DO AGENDADOR');
        return await this.verificarPrazosProximos();
    }
}

module.exports = AgendadorNotificacoes;