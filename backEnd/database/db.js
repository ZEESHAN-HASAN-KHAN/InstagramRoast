const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DB,
  ssl: {
    rejectUnauthorized: false, // For self-signed certificates
  },
});

async function getUserData(username) {
  try {
    const result = await client.query(
      `SELECT
        id,
         profile_pic_url, 
         username, 
         full_name, 
         follower, 
         following, 
         biography, 
         post 
       FROM profiles 
       WHERE username = $1;`,
      [username]
    );

    if (result.rows.length === 0) {
      console.log("User data not found in the database.");
      return null; // Return null if the user data does not exist
    }

    console.log("User data retrieved:", result.rows[0]);
    return result.rows[0]; // Return the user data
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
}

async function dbConnect() {
  console.log("Attempting to connect to the database...");
  try {
    console.log("Database URL:", process.env.DB);
    await client.connect();
    console.log("Database is connected");

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
  
          `);
    const result2 = await client.query(`
              CREATE TABLE IF NOT EXISTS ai_responses (
                  id SERIAL PRIMARY KEY,
                  profile_id INTEGER NOT NULL,
                  response_text TEXT NOT NULL,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
              );
          `);
    const result3 = await client.query(`
      CREATE TABLE IF NOT EXISTS compatibility_responses (
        id SERIAL PRIMARY KEY,
        profile_id_1 INTEGER NOT NULL,
        profile_id_2 INTEGER NOT NULL,
        compatibility_score INTEGER,
        compatibility_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profile_id_1) REFERENCES profiles (id) ON DELETE CASCADE,
        FOREIGN KEY (profile_id_2) REFERENCES profiles (id) ON DELETE CASCADE
      );
    `);
  } catch (err) {
    console.error("Failed to connect to the database:", err.message);
  }
}

async function getAIResponse(username, language) {
  console.log("Language come in " + language);
  try {
    const result = await client.query(
      `SELECT ar.response_text
             FROM ai_responses ar
             JOIN profiles p ON ar.profile_id = p.id
             WHERE p.username = $1 and ar.language = $2;`,
      [username, language]
    );
    return result.rows[0]; // Returns the first matching row
  } catch (error) {
    console.error("Error fetching AI response:", error);
    throw error;
  }
}

const checkCompatibilityResponse = async (profileId1, profileId2, language) => {
  try {
    // Query the database to find the compatibility response
    const result = await client.query(
      `
      SELECT cm.compatibility_text
      FROM compatibility_responses cm
      WHERE 
       ( (cm.profile_id_1 = $1 AND cm.profile_id_2 = $2) OR (cm.profile_id_1 = $2 AND cm.profile_id_2 = $1))
        AND cm.language = $3
      LIMIT 1
      `,
      [profileId1, profileId2, language]
    );

    // Return the result if found
    if (result.rows.length > 0) {
      return {
        success: true,
        compatibilityText: result.rows[0].compatibility_text,
      };
    } else {
      return {
        success: false,
        message:
          "No compatibility response found for the given IDs and language.",
      };
    }
  } catch (error) {
    // Handle errors
    console.error("Error checking compatibility response:", error);
    return {
      success: false,
      message: "An error occurred while checking compatibility.",
    };
  }
};

async function addUser(
  profilePicUrl,
  username,
  fullName,
  follower,
  following,
  biography,
  post
) {
  try {
    const result = await client.query(
      `INSERT INTO profiles 
                (profile_pic_url, username, full_name, follower, following, biography, post) 
             VALUES 
                ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *;`,
      [profilePicUrl, username, fullName, follower, following, biography, post]
    );

    console.log("User added successfully:", result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error("Error adding user:", error);
    throw error;
  }
}
async function checkUserExists(username) {
  try {
    const result = await client.query(
      `SELECT * FROM profiles WHERE username = $1;`,
      [username]
    );

    if (result.rows.length > 0) {
      console.log("User exists:", result.rows[0]);
      return true; // Data exists
    } else {
      console.log("User does not exist");
      return false; // Data does not exist
    }
  } catch (error) {
    console.error("Error checking user existence:", error);
    throw error;
  }
}
async function addAIResponse(username, responseText, language) {
  try {
    // Step 1: Get the profile ID for the given username
    const profileResult = await client.query(
      `SELECT id FROM profiles WHERE username = $1;`,
      [username]
    );

    if (profileResult.rows.length === 0) {
      throw new Error("User not found: Unable to add AI response.");
    }

    const profileId = profileResult.rows[0].id;

    // Step 2: Insert AI response into the ai_responses table
    const insertResult = await client.query(
      `INSERT INTO ai_responses (profile_id, response_text, language)
             VALUES ($1, $2, $3)
             RETURNING *;`,
      [profileId, responseText, language]
    );

    console.log("AI response added successfully:", insertResult.rows[0]);
    return insertResult.rows[0]; // Return the inserted row
  } catch (error) {
    console.error("Error adding AI response:", error.message);
    throw error;
  }
}
// Adding Compatibility Response
async function addCompatiblityResponse(
  username1,
  username2,
  compatiblityText,
  language
) {
  try {
    // Step 1: Get the profile ID for the given username
    const profileResult1 = await client.query(
      `SELECT id FROM profiles WHERE username = $1;`,
      [username1]
    );
    const profileResult2 = await client.query(
      `SELECT id FROM profiles WHERE username = $1;`,
      [username2]
    );
    if (profileResult1.rows.length === 0 || profileResult2.rows.length === 0) {
      throw new Error("User not found: Unable to add AI response.");
    }

    const profileId1 = profileResult1.rows[0].id;
    const profileId2 = profileResult2.rows[0].id;

    // Step 2: Insert AI response into the ai_responses table
    const insertResult = await client.query(
      `INSERT INTO compatibility_responses (profile_id_1,profile_id_2, compatibility_text,language)
             VALUES ($1, $2, $3,$4)
             RETURNING *;`,
      [profileId1, profileId2, compatiblityText, language]
    );

    console.log("AI response added successfully:", insertResult.rows[0]);
    return insertResult.rows[0]; // Return the inserted row
  } catch (error) {
    console.error("Error adding AI response:", error.message);
    throw error;
  }
}
async function profilesRoasted() {
  try {
    // Assuming you are using a PostgreSQL client like 'pg'
    const result = await client.query(
      "SELECT COUNT(*) AS count FROM profiles;"
    );
    const count = result.rows[0].count; // Extract the count value
    console.log("Number of profiles: " + count);
    return parseInt(count, 10); // Ensure the count is returned as a number
  } catch (error) {
    console.error("Error in counting the profiles:", error);
    throw error; // Rethrow the error to handle it further up the call chain
  }
}

module.exports = {
  dbConnect,
  addUser,
  checkUserExists,
  getAIResponse,
  addAIResponse,
  getUserData,
  profilesRoasted,
  addCompatiblityResponse,
  checkCompatibilityResponse,
};
