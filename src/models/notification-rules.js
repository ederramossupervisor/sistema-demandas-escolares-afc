// 📁 /src/models/notification-rules.js
// ✅ SISTEMA DE REGRAS DE NOTIFICAÇÃO POR AÇÃO - VERSÃO CORRIGIDA

const mongoose = require('mongoose');

// 🔧 CLASSE BASE PARA REGRAS DE NOTIFICAÇÃO
class NotificationRule {
    constructor(nome, descricao, condicao, acao) {
        this.nome = nome;
        this.descricao = descricao;
        this.condicao = condicao; // Função que retorna true/false
        this.acao = acao; // Função que executa a notificação
    }

    verificar(dados) {
        if (this.condicao(dados)) {
            console.log(`🎯 REGRA "${this.nome}" ATIVADA: ${this.descricao}`);
            this.acao(dados);
            return true;
        }
        return false;
    }
}

// 📊 SISTEMA DE REGRAS DE NOTIFICAÇÃO
class NotificationSystem {
    constructor(io, socket) {
        this.io = io;
        this.socket = socket;
        this.regras = [];
        this.inicializarRegras();
    }

    inicializarRegras() {
        console.log('🔧 INICIALIZANDO SISTEMA DE REGRAS DE NOTIFICAÇÃO...');

        // 🎯 REGRA 1: NOTIFICAÇÃO DE ATRIBUIÇÃO
        this.regras.push(new NotificationRule(
            'atribuicao',
            'Notificar quando uma demanda é atribuída a um usuário',
            (dados) => dados.acao === 'atribuir' || dados.status === 'atribuido',
            async (dados) => {
                try {
                    // ⚠️ IMPORTAR AQUI DENTRO PARA EVITAR CONFLITOS
                    const Demanda = mongoose.model('Demanda');
                    const Notificacao = mongoose.model('Notificacao');
                    const User = mongoose.model('User');
                    
                    const demanda = await Demanda.findById(dados.demandaId);
                    if (!demanda) return;

                    // 🔍 Buscar usuário atribuído
                    const usuarioAtribuido = await User.findById(demanda.atribuidoA);
                    if (!usuarioAtribuido) return;

                    // 🔍 Buscar diretor para notificar também
                    const diretor = await User.findOne({ tipoUsuario: 'diretor' });
                    const supervisor = await User.findOne({ tipoUsuario: 'supervisor' });

                    // 📝 Criar notificação para o usuário atribuído
                    const notificacaoUsuario = new Notificacao({
                        usuarioId: usuarioAtribuido._id,
                        demandaId: demanda._id,
                        titulo: '📌 Demanda Atribuída',
                        mensagem: `Uma nova demanda "${demanda.titulo}" foi atribuída para você!`,
                        tipo: 'atribuicao',
                        lida: false,
                        data: new Date()
                    });
                    await notificacaoUsuario.save();

                    // 📝 Criar notificação para o diretor (se existir)
                    if (diretor && diretor._id.toString() !== usuarioAtribuido._id.toString()) {
                        const notificacaoDiretor = new Notificacao({
                            usuarioId: diretor._id,
                            demandaId: demanda._id,
                            titulo: '👥 Demanda Atribuída',
                            mensagem: `Demanda "${demanda.titulo}" foi atribuída para ${usuarioAtribuido.nome}`,
                            tipo: 'atribuicao',
                            lida: false,
                            data: new Date()
                        });
                        await notificacaoDiretor.save();
                    }

                    // 📝 Criar notificação para o supervisor (se existir)
                    if (supervisor && supervisor._id.toString() !== usuarioAtribuido._id.toString()) {
                        const notificacaoSupervisor = new Notificacao({
                            usuarioId: supervisor._id,
                            demandaId: demanda._id,
                            titulo: '👥 Demanda Atribuída',
                            mensagem: `Demanda "${demanda.titulo}" foi atribuída para ${usuarioAtribuido.nome}`,
                            tipo: 'atribuicao',
                            lida: false,
                            data: new Date()
                        });
                        await notificacaoSupervisor.save();
                    }

                    // 🔔 Enviar notificação em tempo real via Socket.io
                    this.io.emit('nova-notificacao', {
                        tipo: 'atribuicao',
                        mensagem: `Demanda atribuída: ${demanda.titulo}`,
                        demandaId: demanda._id
                    });

                    console.log(`✅ Notificação de atribuição enviada para: ${usuarioAtribuido.nome}`);

                } catch (error) {
                    console.error('❌ ERRO ao processar notificação de atribuição:', error);
                }
            }
        ));

        // 🔄 REGRA 2: NOTIFICAÇÃO DE MUDANÇA DE STATUS
        this.regras.push(new NotificationRule(
            'mudanca-status',
            'Notificar quando o status de uma demanda muda',
            (dados) => dados.acao === 'mudarStatus' || dados.statusAlterado,
            async (dados) => {
                try {
                    const Demanda = mongoose.model('Demanda');
                    const Notificacao = mongoose.model('Notificacao');
                    const User = mongoose.model('User');
                    
                    const demanda = await Demanda.findById(dados.demandaId);
                    if (!demanda) return;

                    // 🔍 Buscar todos os usuários relacionados
                    const usuariosParaNotificar = [];

                    // 1. Usuário que criou a demanda
                    if (demanda.criadoPor) {
                        const criador = await User.findById(demanda.criadoPor);
                        if (criador) usuariosParaNotificar.push(criador);
                    }

                    // 2. Usuário atribuído
                    if (demanda.atribuidoA) {
                        const atribuido = await User.findById(demanda.atribuidoA);
                        if (atribuido) usuariosParaNotificar.push(atribuido);
                    }

                    // 3. Diretor e Supervisor
                    const diretor = await User.findOne({ tipoUsuario: 'diretor' });
                    const supervisor = await User.findOne({ tipoUsuario: 'supervisor' });
                    if (diretor) usuariosParaNotificar.push(diretor);
                    if (supervisor) usuariosParaNotificar.push(supervisor);

                    // 📝 Criar notificações para cada usuário
                    for (const usuario of usuariosParaNotificar) {
                        const notificacao = new Notificacao({
                            usuarioId: usuario._id,
                            demandaId: demanda._id,
                            titulo: '🔄 Status Alterado',
                            mensagem: `Status da demanda "${demanda.titulo}" mudou para: ${demanda.status}`,
                            tipo: 'status',
                            lida: false,
                            data: new Date()
                        });
                        await notificacao.save();
                    }

                    // 🔔 Enviar notificação em tempo real
                    this.io.emit('nova-notificacao', {
                        tipo: 'status',
                        mensagem: `Status alterado: ${demanda.titulo}`,
                        demandaId: demanda._id
                    });

                    console.log(`✅ Notificação de status enviada para ${usuariosParaNotificar.length} usuários`);

                } catch (error) {
                    console.error('❌ ERRO ao processar notificação de status:', error);
                }
            }
        ));

        // ✏️ REGRA 3: NOTIFICAÇÃO DE EDIÇÃO
        this.regras.push(new NotificationRule(
            'edicao',
            'Notificar quando uma demanda é editada',
            (dados) => dados.acao === 'editar' || dados.editado,
            async (dados) => {
                try {
                    const Demanda = mongoose.model('Demanda');
                    const Notificacao = mongoose.model('Notificacao');
                    const User = mongoose.model('User');
                    
                    const demanda = await Demanda.findById(dados.demandaId);
                    if (!demanda) return;

                    // 🔍 Buscar todos os usuários relacionados (exceto quem editou)
                    const usuariosParaNotificar = [];

                    // 1. Usuário atribuído (se diferente de quem editou)
                    if (demanda.atribuidoA && demanda.atribuidoA.toString() !== dados.usuarioId) {
                        const atribuido = await User.findById(demanda.atribuidoA);
                        if (atribuido) usuariosParaNotificar.push(atribuido);
                    }

                    // 2. Diretor e Supervisor (se diferentes de quem editou)
                    const diretor = await User.findOne({ tipoUsuario: 'diretor' });
                    const supervisor = await User.findOne({ tipoUsuario: 'supervisor' });
                    
                    if (diretor && diretor._id.toString() !== dados.usuarioId) {
                        usuariosParaNotificar.push(diretor);
                    }
                    if (supervisor && supervisor._id.toString() !== dados.usuarioId) {
                        usuariosParaNotificar.push(supervisor);
                    }

                    // 📝 Criar notificações
                    for (const usuario of usuariosParaNotificar) {
                        const notificacao = new Notificacao({
                            usuarioId: usuario._id,
                            demandaId: demanda._id,
                            titulo: '✏️ Demanda Editada',
                            mensagem: `A demanda "${demanda.titulo}" foi editada`,
                            tipo: 'edicao',
                            lida: false,
                            data: new Date()
                        });
                        await notificacao.save();
                    }

                    // 🔔 Enviar notificação em tempo real
                    this.io.emit('nova-notificacao', {
                        tipo: 'edicao',
                        mensagem: `Demanda editada: ${demanda.titulo}`,
                        demandaId: demanda._id
                    });

                    console.log(`✅ Notificação de edição enviada para ${usuariosParaNotificar.length} usuários`);

                } catch (error) {
                    console.error('❌ ERRO ao processar notificação de edição:', error);
                }
            }
        ));

        console.log(`✅ SISTEMA DE REGRAS INICIALIZADO: ${this.regras.length} regras carregadas`);
    }

    // 🔍 PROCESSAR AÇÃO DO SISTEMA
    async processarAcao(acaoDados) {
        console.log(`🔍 PROCESSANDO AÇÃO: ${JSON.stringify(acaoDados)}`);
        
        let algumaRegraAtivada = false;
        
        for (const regra of this.regras) {
            const ativada = await regra.verificar(acaoDados);
            if (ativada) {
                algumaRegraAtivada = true;
            }
        }
        
        return algumaRegraAtivada;
    }
}

module.exports = NotificationSystem;