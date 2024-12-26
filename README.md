
# Instagram Roast Generator

An Express.js-based application that fetches Instagram profile details and generates AI-generated humorous roasts based on the user’s profile picture and details. Built using OpenAI's GPT model for generating witty responses and integrates with a database for storing user information.

## Features
- Fetch Instagram profile details based on username or URL.
- Check if a user already exists in the database.
- Add new users to the database along with their profile data.
- Generate AI-powered roasts using OpenAI's API.
- Store generated roasts in the database for future reference.

---

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/instagram-roast-generator.git
   cd instagram-roast-generator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and add the following:
   ```plaintext
   APIKEY=your_openai_api_key
   PORT=your_port_number
   URL=https://api.instagram.com/your_endpoint
   MODEL_NAME=gpt-4o-mini
   ```

4. Start the server:
   ```bash
   npm start
   ```

---

## API Endpoints

### POST `/roastMe`
Fetches Instagram profile details based on the username and generates a roast.

#### Request Body:
```json
{
  "name": "instagram_username"
}
```

#### Response:
- On Success:
  ```json
  {
    "data": "Generated roast for the user"
  }
  ```
- On Error:
  ```json
  {
    "error": "Error message"
  }
  ```

---

## How It Works

1. **Fetch Instagram Details**: The app uses the Instagram API to retrieve profile details (e.g., profile picture URL).
2. **Check User Existence**: It checks the database to see if the user already exists.
3. **Add New User**: If the user doesn't exist, their profile details are added to the database.
4. **Generate Roast**: The profile details are passed to OpenAI's API to generate a humorous roast.
5. **Store Roast**: The generated roast is stored in the database.

---

## Project Structure

```
.
├── server.js          # Main server file
├── database.js        # Database connection and functions
├── .env               # Environment variables
├── package.json       # Node.js dependencies
└── README.md          # Project documentation
```

---

## Dependencies

- **Node.js**: Backend runtime.
- **Express.js**: Framework for building APIs.
- **OpenAI**: For generating AI responses.
- **dotenv**: Manage environment variables.

---

## Future Enhancements
- Add authentication for API usage.
- Enable multilingual roast generation.
- Integrate frontend for better user experience.
- Improve error handling for API calls.

---

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Contributing
Contributions are welcome! Please fork the repository and submit a pull request.

---

## Author
[Zeeshan Hasan Khan](https://www.linkedin.com/in/zeeshan-hasan-khan-/)
[Arghyadeep Ghosh](https://www.linkedin.com/in/arghyadeep-ghosh/)
Happy roasting! 🎭
