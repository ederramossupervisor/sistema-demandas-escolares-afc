// ARQUIVO: teste-senha.js
const { MongoClient } = require("mongodb");

// Lista de senhas para testar
const senhasParaTestar = [
  "juliaanitaannaclara",  // Senha que estava no código
  "S3nh@F0rt3!2024",      // Possível nova senha
  "Demandas2024!",        // Outra possibilidade
  "admin123",             // Senha simples comum
  "password123"           // Outra comum
];

async function testarSenha(senha) {
  console.log(`\n🔍 Testando: ${senha.substring(0, 3)}...`);
  
  const uri = `mongodb+srv://sistema_escolar_admin:${senha}@cluster0.xejrej5.mongodb.net/sistema_escolar?retryWrites=true&w=majority&appName=Cluster0`;
  
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });

  try {
    await client.connect();
    
    // Testar se consegue listar collections
    const db = client.db("sistema_escolar");
    const collections = await db.listCollections().toArray();
    
    console.log(`✅ ✅ ✅ SENHA CORRETA ENCONTRADA!`);
    console.log(`   Senha: ${senha}`);
    console.log(`   Collections no banco: ${collections.length}`);
    
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    await client.close();
    return { sucesso: true, senha: senha };
    
  } catch (err) {
    console.log(`   ❌ Falhou: ${err.message.split(" ")[0]}...`);
    await client.close();
    return { sucesso: false, senha: senha };
  }
}

async function executarTestes() {
  console.log("=".repeat(60));
  console.log("🔐 TESTE DE SENHA MONGODB ATLAS");
  console.log("=".repeat(60));
  console.log("Usuário: sistema_escolar_admin");
  console.log("Cluster: cluster0.xejrej5.mongodb.net");
  console.log("=".repeat(60));
  
  for (const senha of senhasParaTestar) {
    const resultado = await testarSenha(senha);
    if (resultado.sucesso) {
      console.log("\n" + "=".repeat(60));
      console.log("🎉 USE ESTA SENHA NO .env.production:");
      console.log("=".repeat(60));
      console.log(`MONGODB_URI=mongodb+srv://sistema_escolar_admin:${senha}@cluster0.xejrej5.mongodb.net/sistema_escolar?retryWrites=true&w=majority&appName=Cluster0`);
      console.log("=".repeat(60));
      return;
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  NENHUMA SENHA FUNCIONOU");
  console.log("=".repeat(60));
  console.log("Você precisa resetar a senha:");
  console.log("1. Acesse: https://cloud.mongodb.com");
  console.log("2. Security → Database Access");
  console.log("3. Clique em 'sistema_escolar_admin'");
  console.log("4. Edit → Password → Nova senha");
  console.log("5. Update User");
  console.log("=".repeat(60));
}

executarTestes();