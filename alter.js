const fs = require('fs');
const { Pool } = require('pg');

const envContent = fs.readFileSync('.env.production', 'utf-8');
const lines = envContent.split('\n');
let dbUrl = '';
for (let line of lines) {
    if (line.startsWith('DATABASE_URL=')) {
        dbUrl = line.split('=')[1].trim().replace(/"/g, '');
    }
}

const pool = new Pool({ connectionString: dbUrl });

async function run() {
    try {
        await pool.query("ALTER TABLE novidade_sistema ADD COLUMN IF NOT EXISTS destino VARCHAR(50) DEFAULT 'todos'");
        console.log("OK");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
