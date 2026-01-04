require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔗 Testando conexão...');

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
    console.log('✅ Conectado!');
    
    const User = require('./src/models/User').User;
    const admin = await User.findOne({ email: 'admin@escola.gov.br' });
    
    if (!admin) {
        console.log('❌ Admin não existe no banco');
        return;
    }
    
    console.log('\n🔍 DADOS DO ADMIN:');
    console.log('Nome:', admin.nome);
    console.log('Email:', admin.email);
    console.log('Tipo:', admin.tipo);
    console.log('Senha (30 primeiros):', admin.senha.substring(0, 30));
    console.log('É hash?', admin.senha.startsWith('$'));
    console.log('Primeiro acesso:', admin.primeiroAcesso);
    
    process.exit(0);
})
.catch(err => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
});
