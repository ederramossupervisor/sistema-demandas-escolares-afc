// testar-formulario-senha.js
const fs = require('fs');
const path = require('path');

console.log('🔍 VERIFICANDO FORMULÁRIO ALTERAR-SENHA.EJS...\n');

// Verificar o arquivo alterar-senha.ejs
const viewPath = path.join(__dirname, 'views', 'alterar-senha.ejs');
if (fs.existsSync(viewPath)) {
    const conteudo = fs.readFileSync(viewPath, 'utf8');
    
    // Verificar se tem o formulário com ID
    if (conteudo.includes('id="form-alterar-senha"')) {
        console.log('✅ Formulário encontrado com ID: form-alterar-senha');
    } else {
        console.log('❌ Formulário não tem ID correto');
    }
    
    // Verificar se tem event listener para submit
    if (conteudo.includes('addEventListener') && conteudo.includes('submit')) {
        console.log('✅ Event listener para submit encontrado');
    } else {
        console.log('❌ Não encontrei event listener para submit');
        
        // Mostrar trecho do script
        console.log('\n📝 Trecho do script:');
        const linhas = conteudo.split('\n');
        let inScript = false;
        linhas.forEach((linha, index) => {
            if (linha.includes('<script>')) inScript = true;
            if (linha.includes('</script>')) inScript = false;
            if (inScript && linha.includes('submit')) {
                console.log(`Linha ${index + 1}: ${linha.trim()}`);
            }
        });
    }
    
    // Verificar se tem validação de senha
    if (conteudo.includes('validarForcaSenha')) {
        console.log('✅ Função validarForcaSenha encontrada');
    }
    
    if (conteudo.includes('validarConfirmacaoSenha')) {
        console.log('✅ Função validarConfirmacaoSenha encontrada');
    }
    
} else {
    console.log('❌ Arquivo alterar-senha.ejs não encontrado!');
}

// Verificar se há erros de JavaScript no console do navegador
console.log('\n🎯 PARA VERIFICAR NO NAVEGADOR (F12):');
console.log('1. Abra o console (F12 → Console)');
console.log('2. Clique no botão "Alterar Senha"');
console.log('3. Veja se aparece erro vermelho');
console.log('4. Compartilhe o erro aqui');

// Solução rápida se houver erro
console.log('\n🚀 SOLUÇÃO RÁPIDA:');
console.log('1. No console do navegador, digite:');
console.log('   document.getElementById("form-alterar-senha").submit()');
console.log('2. Se funcionar, o problema é no JavaScript da página');