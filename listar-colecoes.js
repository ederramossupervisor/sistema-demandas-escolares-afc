// listar-colecoes.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

async function listCollections() {
    const client = new MongoClient(process.env.MONGODB_URI);
    
    try {
        await client.connect();
        const db = client.db();
        const collections = await db.listCollections().toArray();
        
        console.log('📚 Coleções disponíveis no banco:');
        console.log('='.repeat(40));
        
        collections.forEach((col, index) => {
            console.log(`${index + 1}. ${col.name}`);
        });
        
        console.log('='.repeat(40));
        console.log(`Total: ${collections.length} coleções`);
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await client.close();
    }
}

listCollections();