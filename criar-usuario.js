const { MongoClient } = require('mongodb'); 
const bcrypt = require('bcrypt'); 
 
async function criarUsuarioEmergencia() { 
    console.log('?? CRIANDO USUµRIO DE EMERGÒNCIA...\n'); 
 
    // SENHA FµCIL - vocˆ pode mudar depois 
    const email = "admin@escola.com"; 
    const senha = "123456"; 
 
    console.log('?? CREDENCIAIS QUE SERÇO CRIADAS:'); 
    console.log('?? Email: ' + email); 
    console.log('?? Senha: ' + senha); 
    console.log('\n?? NOTA: Depois de entrar, ALTERE A SENHA!'); 
    console.log('\n?? Agora siga estes passos MANUAIS:'); 
    console.log('===================================='); 
    console.log('1. Acesse: https://cloud.mongodb.com'); 
    console.log('2. Clique em "Browse Collections"'); 
    console.log('3. Selecione "sistema_escolar" 
    console.log('4. Clique em "INSERT DOCUMENT"'); 
    console.log('5. Cole este JSON:'); 
 
    // Gerar hash da senha 
    const salt = bcrypt.genSaltSync(10); 
    const hash = bcrypt.hashSync(senha, salt); 
 
    const usuarioJSON = { 
        email: email, 
        password: hash, 
        name: "Administrador Emergencia", 
        role: "admin", 
        department: "TI", 
        active: true, 
        createdAt: new Date(), 
        settings: { notifications: true, theme: "light" } 
    }; 
 
    console.log(JSON.stringify(usuarioJSON, null, 2)); 
    console.log('\n6. Clique em "Insert" para salvar'); 
    console.log('7. Agora fa‡a login no site:'); 
    console.log('   ?? https://sistema-demandas-escolares-afc.onrender.com'); 
    console.log('   ?? Email: admin@escola.com'); 
    console.log('   ?? Senha: 123456'); 
} 
 
criarUsuarioEmergencia(); 
