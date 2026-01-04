require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

console.log('🔗 Conectando...');

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
    console.log('✅ Conectado!');
    
    const User = require('./src/models/User').User;
    const admin = await User.findOne({ email: 'admin@escola.gov.br' });
    
    if (!admin) {
        console.log('❌ Admin não encontrado');
        return;
    }
    
    console.log('\n🔍 ANTES DA CORREÇÃO:');
    console.log('Nome:', admin.nome);
    console.log('Email:', admin.email);
    console.log('Senha:', admin.senha);
    console.log('Tipo:', admin.tipo);
    console.log('Departamento:', admin.departamento);
    console.log('Primeiro acesso:', admin.primeiroAcesso);
    console.log('É hash?', admin.senha.startsWith(''));
    
    // 1. CORRIGIR SENHA (se não estiver hasheada)
    if (!admin.senha.startsWith('')) {
        console.log('\n⚠️ SENHA NÃO HASHED! Corrigindo...');
        const salt = await bcrypt.genSalt(10);
        admin.senha = await bcrypt.hash(admin.senha, salt);
        console.log('✅ Senha hasheada');
    }
    
    // 2. CORRIGIR DEPARTAMENTO (se necessário)
    if (admin.departamento === 'Supervisão' || admin.departamento === 'supervisao') {
        console.log('✅ Departamento já correto:', admin.departamento);
    } else {
        console.log('\n🔄 Ajustando departamento para "Supervisão"...');
        admin.departamento = 'Supervisão';
    }
    
    // 3. GARANTIR PRIMEIRO ACESSO
    admin.primeiroAcesso = true;
    admin.obrigarAlteracaoSenha = true;
    
    // 4. SALVAR
    await admin.save();
    
    console.log('\n✅ ADMIN CORRIGIDO!');
    console.log('📧 Email: admin@escola.gov.br');
    console.log('🔑 Senha: Admin123');
    console.log('🎯 Primeiro acesso: SIM');
    console.log('🏢 Departamento:', admin.departamento);
    
    // 5. TESTAR
    const testUser = await User.findOne({ email: 'admin@escola.gov.br' });
    const funciona = await testUser.compararSenha('Admin123');
    console.log('\n🧪 Teste login:', funciona ? '✅ FUNCIONA!' : '❌ FALHOU');
    
    if (funciona) {
        console.log('\n🎉 PRONTO PARA TESTE!');
        console.log('1. Abra: http://localhost:3000');
        console.log('2. Email: admin@escola.gov.br');
        console.log('3. Senha: Admin123');
        console.log('4. Deve redirecionar para /alterar-senha');
    }
    
    process.exit(0);
})
.catch(err => {
    console.error('❌ Erro:', err.message);
    if (err.message.includes('departamento')) {
        console.log('\n💡 PROBLEMA: Schema User.js não está atualizado!');
        console.log('Abra src/models/User.js e atualize:');
        console.log('enum: ["Supervisão", "Gestão", "Pedagógico", "Secretaria", null]');
    }
    process.exit(1);
});
