const mongoose = require('mongoose');

const notificacaoSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    titulo: {
        type: String,
        required: true,
        trim: true
    },
    mensagem: {
        type: String,
        required: true,
        trim: true
    },
    tipo: {
        type: String,
        enum: ['success', 'error', 'warning', 'info', 'demanda'],
        default: 'info'
    },
    lida: {
        type: Boolean,
        default: false
    },
    link: {
        type: String,
        default: ''
    },
    dataCriacao: {
        type: Date,
        default: Date.now
    },
    dataLeitura: {
        type: Date
    }
});

// Índice para buscas rápidas por usuário
notificacaoSchema.index({ usuarioId: 1, lida: 1, dataCriacao: -1 });

module.exports = mongoose.model('Notificacao', notificacaoSchema);