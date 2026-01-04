/**
 * 📝 MODELO: Solicitação de Cadastro
 * Armazena solicitações de novos usuários pendentes de aprovação
 * Versão: 1.0 - Criado com Eder 🚀
 */

const mongoose = require('mongoose');

const solicitacaoCadastroSchema = new mongoose.Schema({
    // Dados do solicitante
    nomeCompleto: {
        type: String,
        required: [true, 'Nome completo é obrigatório'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'E-mail é obrigatório'],
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Por favor, insira um e-mail válido']
    },
    funcao: {
        type: String,
        required: [true, 'Função é obrigatória'],
        enum: ['Supervisor(a)', 'Diretor(a)', 'Casf', 'ASE', 'Coordenador(a) Pedagógico(a)', 'Pedagogo(a)', 'Outro']
    },
    departamento: {
        type: String,
        required: [true, 'Departamento é obrigatório'],
        trim: true
    },
    escola: {
        type: String,
        required: [true, 'Escola é obrigatória'],
        trim: true
    },
    
    // Status da solicitação
    status: {
        type: String,
        enum: ['pendente', 'aprovada', 'rejeitada', 'expirada'],
        default: 'pendente'
    },
    
    // Informações de processamento
    processadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    dataProcessamento: Date,
    motivoRejeicao: String,
    
    // Controle de expiração (solicitações expiram em 7 dias)
    dataExpiracao: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
    },
    
    // Timestamps
    dataCriacao: {
        type: Date,
        default: Date.now
    },
    dataAtualizacao: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'dataCriacao', updatedAt: 'dataAtualizacao' }
});

// Índices para performance
solicitacaoCadastroSchema.index({ email: 1, status: 1 });
solicitacaoCadastroSchema.index({ status: 1, dataCriacao: -1 });
solicitacaoCadastroSchema.index({ dataExpiracao: 1 }, { expireAfterSeconds: 0 });

// Método para verificar se está expirado
solicitacaoCadastroSchema.methods.estaExpirado = function() {
    return new Date() > this.dataExpiracao;
};

// Método para aprovar
solicitacaoCadastroSchema.methods.aprovar = function(adminId) {
    this.status = 'aprovada';
    this.processadoPor = adminId;
    this.dataProcessamento = new Date();
    return this.save();
};

// Método para rejeitar
solicitacaoCadastroSchema.methods.rejeitar = function(adminId, motivo) {
    this.status = 'rejeitada';
    this.processadoPor = adminId;
    this.dataProcessamento = new Date();
    this.motivoRejeicao = motivo || 'Solicitação rejeitada pelo administrador';
    return this.save();
};

// Middleware para atualizar dataExpiracao se status mudar para pendente
solicitacaoCadastroSchema.pre('save', function(next) {
    if (this.isModified('status') && this.status === 'pendente') {
        this.dataExpiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    next();
});

const SolicitacaoCadastro = mongoose.model('SolicitacaoCadastro', solicitacaoCadastroSchema);

module.exports = SolicitacaoCadastro;