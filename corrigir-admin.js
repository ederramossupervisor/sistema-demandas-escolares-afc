require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

console.log(' Conectando ao MongoDB...');

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
    console.log(' Conectado ao MongoDB!');
    
    const User = require('./src/models/User').User;
    
    // 1. BUSCAR OU CRIAR ADMIN
    let admin = await User.findOne({ email: 'admin@escola.gov.br' });
    
    if (!admin) {
        console.log(' Admin não encontrado, criando...');
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('Admin123', salt);
        
        admin = new User({
            nome: 'Admin Sistema',
            email: 'admin@escola.gov.br',
            senha: hash,
            tipo: 'administrador',
            primeiroAcesso: true,
            obrigarAlteracaoSenha: true,
            ativo: true
        });
        
        await admin.save();
        console.log(' Admin criado!');
    }
    
    // 2. VERIFICAR SENHA
    console.log('\n Verificando admin:');
    console.log('- Email:', admin.email);
    console.log('- Hash:', admin.senha.substring(0, 30) + '...');
    console.log('- É hash bcrypt?', admin.senha.startsWith('$') ? ' Sim' : ' NÃO!');
    console.log('- Primeiro acesso:', admin.primeiroAcesso);
    
    // 3. CORRIGIR SE NECESSÁRIO
    if (!admin.senha.startsWith('$')) {
        console.log('\n SENHA NÃO ESTÁ HASHED! Corrigindo...');
        
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(admin.senha, salt);
        
        admin.senha = hash;
        admin.primeiroAcesso = true;
        admin.obrigarAlteracaoSenha = true;
        
        await admin.save();
        console.log(' Senha corrigida!');
    }
    
    // 4. TESTAR LOGIN
    console.log('\n Testando login:');
    
    const senhaCorreta = await admin.compararSenha('Admin123');
    console.log('- Senha "Admin123":', senhaCorreta ? ' CORRETA' : ' ERRADA');
    
    const senhaErrada = await admin.compararSenha('senhaerrada');
    console.log('- Senha errada:', senhaErrada ? ' ACEITA' : ' REJEITADA');
    
    if (senhaCorreta) {
        console.log('\n PRONTO PARA TESTAR!');
        console.log(' Email: admin@escola.gov.br');
        console.log(' Senha: Admin123');
        console.log(' Deve redirecionar para /alterar-senha');
    }
    
    process.exit(0);
})
.catch(err => {
    console.error(' Erro:', err.message);
    process.exit(1);
});
