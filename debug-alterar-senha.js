// debug-alterar-senha.js
const express = require('express');
const app = express();

// Simular a rota para verificar o erro
app.get('/teste-rota', (req, res) => {
    console.log('Testando rota /teste-rota...');
    res.send('Rota funcionando');
});

// Verificar se o servidor principal está respondendo
const http = require('http');

async function testarRotas() {
    console.log('🔍 TESTANDO ROTAS DO SERVIDOR...');
    
    // Testar rota raiz
    try {
        const response1 = await fetch('http://localhost:3000/');
        console.log(`✅ / - Status: ${response1.status}`);
    } catch (error) {
        console.log(`❌ / - Erro: ${error.message}`);
    }
    
    // Testar rota login
    try {
        const response2 = await fetch('http://localhost:3000/login');
        console.log(`✅ /login - Status: ${response2.status}`);
    } catch (error) {
        console.log(`❌ /login - Erro: ${error.message}`);
    }
    
    // Testar rota alterar-senha (deve dar erro 500)
    try {
        const response3 = await fetch('http://localhost:3000/alterar-senha');
        console.log(`📊 /alterar-senha - Status: ${response3.status}`);
        console.log(`📊 /alterar-senha - Status Text: ${response3.statusText}`);
        
        if (response3.status === 500) {
            console.log('❌ ERRO 500 em /alterar-senha');
            console.log('🔍 Vamos verificar os logs do servidor...');
        }
    } catch (error) {
        console.log(`❌ /alterar-senha - Erro: ${error.message}`);
    }
}

// Executar teste
testarRotas();