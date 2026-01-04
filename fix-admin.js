const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = 'mongodb+srv://sistema_escolar_admin:juliaanitaannaclara@cluster0.xejrej5.mongodb.net/sistema_escolar?retryWrites=true&w=majority';

async function fixAdmin() {
  try {
    console.log('🔗 Conectando ao MongoDB...');
    await mongoose.connect(MONGODB_URI);
    
    // Schema temporário
    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', userSchema);
    
    // Verificar admin
    let admin = await User.findOne({ email: 'admin@escola.com' });
    
    if (!admin) {
      console.log('❌ Admin não encontrado. Criando...');
      const hash = await bcrypt.hash('SenhaAdmin123', 10);
      
      admin = new User({
        nome: 'Administrador',
        email: 'admin@escola.com',
        senha: hash,
        tipo: 'administrador',
        ativo: true
      });
      
      await admin.save();
      console.log('✅ Admin criado!');
    } else {
      console.log('✅ Admin encontrado. Atualizando senha...');
      const hash = await bcrypt.hash('SenhaAdmin123', 10);
      
      await User.updateOne(
        { email: 'admin@escola.com' },
        { $set: { senha: hash } }
      );
      
      console.log('✅ Senha atualizada!');
    }
    
    // Verificação
    const check = await User.findOne({ email: 'admin@escola.com' });
    console.log('\n📋 VERIFICAÇÃO FINAL:');
    console.log('📧 Email:', check.email);
    console.log('👤 Nome:', check.nome || 'Administrador');
    console.log('🎯 Tipo:', check.tipo || 'administrador');
    console.log('✅ Ativo:', check.ativo !== false ? 'Sim' : 'Não');
    
    console.log('\n🚀 AGORA ACESSE:');
    console.log('🌐 https://sistema-demandas-escolares-afc.onrender.com');
    console.log('🔐 admin@escola.com / SenhaAdmin123');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
  }
}

fixAdmin();