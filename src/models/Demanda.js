const mongoose = require('mongoose');

const demandaSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  descricao: {
    type: String,
    required: true,
    trim: true
  },
  escola: {
    type: String,
    required: true,
    enum: [
      'EMEF Profª Maria de Lourdes Pinheiro',
      'EMEF Profª Neuza Rocha',
      'EMEF Profª Idalina Macedo Costa Sodré',
      'EMEF Paulo Freire',
      'EMEF Galdino Leite',
      'EMEF Dr Rui Pacheco',
      'EMEF Tancredo Neves',
      'EMEF Maestro Rui Capdeville',
      'EMEF Eliete',
      'EMEF Sebastião Rocha',
      'EMEF Manoel da Hora',
      'EMEF João Neto de Campos',
      'EMEF Leôncio Pimentel',
      'EMEF São Sebastião',
      'EMEF Maria Antonieta A Redig',
      'EMEF da Estiva',
      'EMEF Paulo de Assis Ribeiro',
      'EMEF Vargem Grande',
      'EMEF João de Deus',
      'EMEF Jacyra Tavares',
      'EMEF Professora Marlene Flores',
      'EMEF Profª Marieta Soares',
      'EMEF Professora Simone dos Santos Almeida',
      'EMEF Crispiniano Soares',
      'EMEF Sebastião Gomes de Oliveira',
      'EMEF Jandira de Andrade Lima',
      'EMEF Imaculada Conceição',
      'EMEF Manoel Messias',
      'EMEF Maria Barreiros',
      'EMEF Maria do Rosário Tavares'
    ]
  },
  departamento: {
    type: String,
    required: true,
    enum: ['Pedagogico', 'Administrativo', 'Manutenção', 'Recursos Humanos', 'Alimentação', 'Transporte', 'Outros']
  },
  prioridade: {
    type: String,
    required: true,
    enum: ['Baixa', 'Média', 'Alta', 'Urgente'],
    default: 'Média'
  },
  status: {
    type: String,
    required: true,
    enum: ['Pendente', 'Em Andamento', 'Concluída', 'Cancelada'],
    default: 'Pendente'
  },
  criadoPor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  responsavel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dataCriacao: {
    type: Date,
    default: Date.now
  },
  prazo: {
    type: Date,
    required: true
  },
  dataConclusao: {
    type: Date
  },
  anexos: [{
    nome: String,
    url: String,
    tipo: String,
    tamanho: Number
  }],
  historico: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acao: String,
    detalhes: String,
    data: {
      type: Date,
      default: Date.now
    }
  }],
  comentarios: [{
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    texto: String,
    data: {
      type: Date,
      default: Date.now
    }
  }]
});

// Índices para melhorar performance nas buscas
demandaSchema.index({ escola: 1, status: 1 });
demandaSchema.index({ criadoPor: 1 });
demandaSchema.index({ responsavel: 1 });
demandaSchema.index({ prazo: 1 });

const Demanda = mongoose.model('Demanda', demandaSchema);

module.exports = Demanda;