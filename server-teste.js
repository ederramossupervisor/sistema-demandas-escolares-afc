// server-teste.js - VERSÃO SUPER SIMPLES
const express = require('express');
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
    res.send(`
        <html>
        <body>
            <h1>✅ Servidor TESTE funcionando!</h1>
            <p>Se esta página carregar, o Express está OK.</p>
            <p>Agora vamos testar o servidor real.</p>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`✅ Servidor TESTE rodando: http://localhost:${PORT}`);
});