const { Client } = require('pg')

const client = new Client({
    connectionString:"DB string"
})

async function dbConnect()
{
    await client.connect();
    console.log('Database is connected');
}