# Quizzzy

**An interactive quiz platform with solo gameplay and real-time multiplayer rooms.**

Quizzzy is a web-based quiz application built with JavaScript, Node.js, Express, Socket.IO, and MySQL. It is designed to make quizzes more interactive with room-based multiplayer sessions, live score updates, and a leaderboard.

## ✨ Features

- **Create Quiz** — Create quizzes for players to answer.
- **Join Game** — Join a multiplayer session using a room code.
- **Solo Quiz** — Play quizzes individually.
- **Multiplayer Lobby** — Join a room and wait for the host to start the game.
- **Host Controls** — Host-managed multiplayer sessions.
- **Live Leaderboard** — Track player scores during a game.
- **Final Results** — Display rankings and scores after the quiz.
- **Server-side Scoring** — Process quiz scoring on the server.
- **Quiz Library** — Browse available quizzes.
- **Audio Experience** — Sound effects and background music controls.

## 🛠️ Tech Stack

- HTML5
- CSS3
- JavaScript
- Node.js
- Express.js
- Socket.IO
- MySQL
- npm

## 📁 Project Structure

```text
quizzzy/
├── assets/
├── index.html
├── script.js
├── style.css
├── server.js
├── package.json
├── package-lock.json
└── README.md
```

## ⚙️ Requirements

- Node.js and npm
- MySQL Server
- A browser such as Chrome or Firefox

XAMPP can be used to run MySQL locally.

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Tamj-delcroix/quizzzy.git
cd quizzzy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root and configure the variables required by `server.js`.

Do not commit your `.env` file, database credentials, or other secrets to GitHub.

### 4. Set up the database

Start MySQL and create the database and tables required by the application.

Use the database schema or setup instructions provided with the project. Verify the database name and connection settings against your server configuration.

### 5. Start the application

Use the start command configured in `package.json`. If the project defines a `start` script, run:

```bash
npm start
```

Open the local URL shown by the server in your browser.

## 🔐 Security

- Keep database credentials in environment variables.
- Never publish real secrets or passwords.
- Use strong authentication credentials for any administrative account.
- Review authentication, authorization, input validation, and multiplayer event handling before public deployment.

## 👨‍💻 Author

**Tamj-delcroix**

- GitHub: https://github.com/Tamj-delcroix

## 📌 Project Status

This project is being developed as a web development and portfolio project. Features and implementation details may evolve over time.

## 📄 License

No license has been specified yet. Contact the repository owner before reusing or redistributing this project.
