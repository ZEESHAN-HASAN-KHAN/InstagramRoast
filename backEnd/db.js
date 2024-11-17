const { Client } = require('pg')

const client = new Client({
    connectionString:process.env.DB
})

async function dbConnect()
{
    await client.connect();

    console.log('Database is connected');
    const result = await client.query(`
                    CREATE TABLE IF NOT EXISTS profiles (
                id SERIAL PRIMARY KEY,
                profile_pic_url TEXT,
                username VARCHAR(50) UNIQUE NOT NULL,
                full_name VARCHAR(255),
                follower INTEGER,
                following INTEGER,
                biography TEXT,
                post INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

        `)
}


async function addUser(profilePicUrl, username, fullName, follower, following, biography, post) {
    try {
        const result = await client.query(
            `INSERT INTO profiles 
                (profile_pic_url, username, full_name, follower, following, biography, post) 
             VALUES 
                ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *;`,
            [profilePicUrl, username, fullName, follower, following, biography, post]
        );

        console.log('User added successfully:', result.rows[0]);
        return result.rows[0];
    } catch (error) {
        console.error('Error adding user:', error);
        throw error;
    }
}

module.exports = { dbConnect, addUser };