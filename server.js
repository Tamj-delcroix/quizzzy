// ============================================================
// QUIZZZY SERVER
// Express + MySQL + Socket.IO
// ============================================================

const express = require("express");
const http = require("http");
const cors = require("cors");
const mysql = require("mysql2/promise");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============================================================
// MYSQL
// ============================================================

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ============================================================
// ACTIVE ROOMS
// ============================================================

const activeRooms = {};

// ============================================================
// HELPERS
// ============================================================

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

async function getUniqueRoomCode() {
  let code;
  let exists = true;

  while (exists) {
    code = generateRoomCode();

    const [rows] = await pool.query(
      "SELECT id FROM rooms WHERE room_code = ? LIMIT 1",
      [code],
    );

    exists = rows.length > 0;
  }

  return code;
}

// ============================================================
// TEST API
// ============================================================

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Quizzzy server is running!",
  });
});

// ============================================================
// GET QUIZZES
// ============================================================

app.get("/api/quizzes", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        q.id,
        q.title,
        q.description,
        q.created_at,
        COUNT(questions.id) AS question_count
      FROM quizzes q
      LEFT JOIN questions
        ON questions.quiz_id = q.id
      GROUP BY
        q.id,
        q.title,
        q.description,
        q.created_at
      ORDER BY q.id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("GET QUIZZES ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil quiz.",
    });
  }
});

// ============================================================
// GET SINGLE QUIZ
// ============================================================

app.get("/api/quizzes/:id", async (req, res) => {
  try {
    const quizId = Number(req.params.id);

    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID quiz tidak valid.",
      });
    }

    const [quizRows] = await pool.query(
      `
        SELECT
          id,
          title,
          description,
          created_at
        FROM quizzes
        WHERE id = ?
        LIMIT 1
      `,
      [quizId],
    );

    if (quizRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz tidak ditemukan.",
      });
    }

    const [questions] = await pool.query(
      `
        SELECT
          id,
          question,
          question_order,
          time_limit
        FROM questions
        WHERE quiz_id = ?
        ORDER BY question_order ASC
      `,
      [quizId],
    );

    for (const question of questions) {
      const [answers] = await pool.query(
        `
          SELECT
            id,
            answer_text,
            is_correct
          FROM answers
          WHERE question_id = ?
          ORDER BY id ASC
        `,
        [question.id],
      );

      question.answers = answers;
    }

    res.json({
      success: true,
      quiz: quizRows[0],
      questions,
    });
  } catch (error) {
    console.error("GET SINGLE QUIZ ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil detail quiz.",
    });
  }
});

// ============================================================
// CREATE QUIZ
// ============================================================

app.post("/api/quizzes", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { title, description, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: "Data quiz tidak lengkap.",
      });
    }

    await connection.beginTransaction();

    const [quizResult] = await connection.query(
      `
        INSERT INTO quizzes
        (title, description)
        VALUES (?, ?)
      `,
      [title, description || ""],
    );

    const quizId = quizResult.insertId;

    for (let i = 0; i < questions.length; i++) {
      const questionData = questions[i];

      const [questionResult] = await connection.query(
        `
          INSERT INTO questions
          (quiz_id, question, question_order, time_limit)
          VALUES (?, ?, ?, ?)
        `,
        [quizId, questionData.question, i + 1, questionData.time_limit || 15],
      );

      const questionId = questionResult.insertId;

      if (questionData.answers && Array.isArray(questionData.answers)) {
        for (const answer of questionData.answers) {
          await connection.query(
            `
              INSERT INTO answers
              (question_id, answer_text, is_correct)
              VALUES (?, ?, ?)
            `,
            [questionId, answer.answer_text, answer.is_correct ? 1 : 0],
          );
        }
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Quiz berhasil dibuat.",
      quizId,
    });
  } catch (error) {
    await connection.rollback();

    console.error("CREATE QUIZ ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal membuat quiz.",
    });
  } finally {
    connection.release();
  }
});

// ============================================================
// UPDATE QUIZ
// ============================================================

app.put("/api/quizzes/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const quizId = Number(req.params.id);
    const { title, description, questions } = req.body;

    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID quiz tidak valid.",
      });
    }

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Data quiz tidak lengkap.",
      });
    }

    const [quizRows] = await connection.query(
      "SELECT id FROM quizzes WHERE id = ? LIMIT 1",
      [quizId],
    );

    if (quizRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz tidak ditemukan.",
      });
    }

    await connection.beginTransaction();

    await connection.query(
      "UPDATE quizzes SET title = ?, description = ? WHERE id = ?",
      [title.trim(), description || "", quizId],
    );

    const [oldQuestions] = await connection.query(
      "SELECT id FROM questions WHERE quiz_id = ?",
      [quizId],
    );

    if (oldQuestions.length > 0) {
      const oldQuestionIds = oldQuestions.map((question) => question.id);

      await connection.query("DELETE FROM answers WHERE question_id IN (?)", [
        oldQuestionIds,
      ]);
    }

    await connection.query("DELETE FROM questions WHERE quiz_id = ?", [quizId]);

    for (let i = 0; i < questions.length; i++) {
      const questionData = questions[i];

      const questionText = String(questionData.question || "").trim();

      const timeLimit = Number(questionData.time_limit) || 15;

      if (!questionText) {
        throw new Error(`Question ${i + 1} belum diisi.`);
      }

      const [questionResult] = await connection.query(
        `
          INSERT INTO questions
          (quiz_id, question, question_order, time_limit)
          VALUES (?, ?, ?, ?)
        `,
        [quizId, questionText, i + 1, timeLimit],
      );

      const questionId = questionResult.insertId;

      const answers = Array.isArray(questionData.answers)
        ? questionData.answers
        : [];

      if (answers.length === 0) {
        throw new Error(`Question ${i + 1} belum memiliki jawaban.`);
      }

      for (const answer of answers) {
        const answerText = String(answer.answer_text || "").trim();

        if (!answerText) {
          throw new Error(
            `Semua pilihan jawaban Question ${i + 1} wajib diisi.`,
          );
        }

        await connection.query(
          `
            INSERT INTO answers
            (question_id, answer_text, is_correct)
            VALUES (?, ?, ?)
          `,
          [questionId, answerText, answer.is_correct ? 1 : 0],
        );
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Quiz berhasil diperbarui.",
      quizId,
    });
  } catch (error) {
    await connection.rollback();

    console.error("UPDATE QUIZ ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Gagal memperbarui quiz.",
    });
  } finally {
    connection.release();
  }
});

// ============================================================
// DELETE QUIZ
// ============================================================

app.delete("/api/quizzes/:id", async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const quizId = Number(req.params.id);

    if (!Number.isInteger(quizId) || quizId <= 0) {
      return res.status(400).json({
        success: false,
        message: "ID quiz tidak valid.",
      });
    }

    const [quizRows] = await connection.query(
      "SELECT id, title FROM quizzes WHERE id = ? LIMIT 1",
      [quizId],
    );

    if (quizRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz tidak ditemukan.",
      });
    }

    const [activeRoomRows] = await connection.query(
      `
        SELECT id, room_code, status
        FROM rooms
        WHERE quiz_id = ?
        AND status IN ('waiting', 'playing')
        LIMIT 1
      `,
      [quizId],
    );

    if (activeRoomRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Quiz sedang digunakan oleh room ${activeRoomRows[0].room_code}. Selesaikan atau tutup room tersebut terlebih dahulu.`,
      });
    }

    await connection.beginTransaction();

    const [questions] = await connection.query(
      "SELECT id FROM questions WHERE quiz_id = ?",
      [quizId],
    );

    if (questions.length > 0) {
      const questionIds = questions.map((question) => question.id);

      await connection.query("DELETE FROM answers WHERE question_id IN (?)", [
        questionIds,
      ]);
    }

    await connection.query("DELETE FROM questions WHERE quiz_id = ?", [quizId]);

    const [rooms] = await connection.query(
      "SELECT id FROM rooms WHERE quiz_id = ?",
      [quizId],
    );

    if (rooms.length > 0) {
      const roomIds = rooms.map((room) => room.id);

      await connection.query("DELETE FROM results WHERE room_id IN (?)", [
        roomIds,
      ]);

      await connection.query("DELETE FROM players WHERE room_id IN (?)", [
        roomIds,
      ]);

      await connection.query("DELETE FROM rooms WHERE quiz_id = ?", [quizId]);
    }

    await connection.query("DELETE FROM quizzes WHERE id = ?", [quizId]);

    await connection.commit();

    res.json({
      success: true,
      message: "Quiz berhasil dihapus.",
      quizId,
    });
  } catch (error) {
    await connection.rollback();

    console.error("DELETE QUIZ ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal menghapus quiz.",
    });
  } finally {
    connection.release();
  }
});

// ============================================================
// GET ROOM RESULTS
// ============================================================

app.get("/api/results/:roomCode", async (req, res) => {
  try {
    const roomCode = String(req.params.roomCode || "")
      .trim()
      .toUpperCase();

    if (!roomCode) {
      return res.status(400).json({
        success: false,
        message: "Room code wajib diisi.",
      });
    }

    const [roomRows] = await pool.query(
      `
        SELECT
          r.id,
          r.room_code,
          r.status,
          r.quiz_id,
          q.title AS quiz_title
        FROM rooms r
        LEFT JOIN quizzes q ON q.id = r.quiz_id
        WHERE r.room_code = ?
        LIMIT 1
      `,
      [roomCode],
    );

    if (roomRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Room tidak ditemukan.",
      });
    }

    const [results] = await pool.query(
      `
        SELECT
          rank_position AS rank,
          player_name AS name,
          score,
          correct_answers AS correctAnswers,
          wrong_answers AS wrongAnswers
        FROM results
        WHERE room_id = ?
        ORDER BY rank_position ASC
      `,
      [roomRows[0].id],
    );

    const totalQuestions = results.reduce(
      (max, result) =>
        Math.max(
          max,
          Number(result.correctAnswers || 0) + Number(result.wrongAnswers || 0),
        ),
      0,
    );

    const leaderboard = results.map((result) => ({
      rank: Number(result.rank),
      name: result.name,
      score: Number(result.score || 0),
      correctAnswers: Number(result.correctAnswers || 0),
      wrongAnswers: Number(result.wrongAnswers || 0),
      accuracy:
        totalQuestions > 0
          ? Math.round(
              (Number(result.correctAnswers || 0) / totalQuestions) * 100,
            )
          : 0,
    }));

    res.json({
      success: true,
      room: roomRows[0],
      totalQuestions,
      leaderboard,
    });
  } catch (error) {
    console.error("GET ROOM RESULTS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal mengambil hasil game.",
    });
  }
});

// ============================================================
// CREATE ROOM
// ============================================================

app.post("/api/rooms", async (req, res) => {
  try {
    const { quizId, hostName } = req.body;

    if (!quizId || !hostName) {
      return res.status(400).json({
        success: false,
        message: "Quiz dan nama host wajib diisi.",
      });
    }

    const [quizRows] = await pool.query(
      "SELECT id, title FROM quizzes WHERE id = ? LIMIT 1",
      [quizId],
    );

    if (quizRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Quiz tidak ditemukan.",
      });
    }

    const roomCode = await getUniqueRoomCode();

    const [result] = await pool.query(
      `
        INSERT INTO rooms
        (room_code, quiz_id, host_name, status)
        VALUES (?, ?, ?, 'waiting')
      `,
      [roomCode, quizId, hostName],
    );

    activeRooms[roomCode] = {
      roomId: result.insertId,
      roomCode,
      quizId,
      quizTitle: quizRows[0].title,

      host: {
        socketId: null,
        name: hostName,
      },

      players: [],

      status: "waiting",

      questions: [],
      currentQuestionIndex: 0,
      questionStartedAt: null,
      questionTimer: null,
      resultsSaved: false,
    };

    res.json({
      success: true,

      room: {
        id: result.insertId,
        roomCode,
        quizId,
        quizTitle: quizRows[0].title,
        hostName,
        status: "waiting",
      },
    });
  } catch (error) {
    console.error("CREATE ROOM ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Gagal membuat room.",
    });
  }
});

// ============================================================
// LOAD QUESTIONS
// ============================================================

async function loadQuizQuestions(quizId) {
  const [questions] = await pool.query(
    `
      SELECT
        id,
        question,
        question_order,
        time_limit
      FROM questions
      WHERE quiz_id = ?
      ORDER BY question_order ASC
    `,
    [quizId],
  );

  for (const question of questions) {
    const [answers] = await pool.query(
      `
        SELECT
          id,
          answer_text
        FROM answers
        WHERE question_id = ?
        ORDER BY id ASC
      `,
      [question.id],
    );

    question.answers = answers;
  }

  return questions;
}

// ============================================================
// SEND ROOM STATE
// ============================================================

function broadcastRoomState(roomCode) {
  const room = activeRooms[roomCode];

  if (!room) return;

  io.to(roomCode).emit("roomState", {
    roomCode: room.roomCode,

    host: {
      name: room.host.name,
      socketId: room.host.socketId,
    },

    players: room.players.map((player) => ({
      socketId: player.socketId,
      name: player.name,
      score: player.score || 0,
      currentQuestion: player.currentQuestion || 0,
      finished: player.finished || false,
      correctAnswers: player.correctAnswers || 0,
      wrongAnswers: player.wrongAnswers || 0,
    })),

    status: room.status,
  });
}

// ============================================================
// SEND CURRENT QUESTION
// ============================================================

function sendCurrentQuestion(roomCode) {
  const room = activeRooms[roomCode];

  if (!room) return;

  const question = room.questions[room.currentQuestionIndex];

  if (!question) {
    finishGame(roomCode);
    return;
  }

  const timeLimit = Number(question.time_limit) || 15;

  room.questionStartedAt = Date.now();

  io.to(roomCode).emit("gameQuestion", {
    questionNumber: room.currentQuestionIndex + 1,

    totalQuestions: room.questions.length,

    question: question.question,

    answers: question.answers.map((answer) => ({
      id: answer.id,
      answer_text: answer.answer_text,
    })),

    timeLimit,
  });

  console.log(
    `🎯 Room ${roomCode} - Question ${room.currentQuestionIndex + 1}/${room.questions.length}`,
  );

  clearTimeout(room.questionTimer);

  room.questionTimer = setTimeout(() => {
    io.to(roomCode).emit("questionTimeout", {
      questionNumber: room.currentQuestionIndex + 1,
    });

    setTimeout(() => {
      nextQuestion(roomCode);
    }, 1500);
  }, timeLimit * 1000);
}

// ============================================================
// NEXT QUESTION
// ============================================================

function nextQuestion(roomCode) {
  const room = activeRooms[roomCode];

  if (!room) return;

  clearTimeout(room.questionTimer);

  room.players.forEach((player) => {
    if (!player.hasAnswered) {
      player.wrongAnswers = (player.wrongAnswers || 0) + 1;

      player.hasAnswered = true;
    }
  });

  room.currentQuestionIndex++;

  if (room.currentQuestionIndex >= room.questions.length) {
    finishGame(roomCode);
    return;
  }

  room.players.forEach((player) => {
    player.hasAnswered = false;
    player.currentQuestion = room.currentQuestionIndex + 1;
  });

  broadcastRoomState(roomCode);

  sendCurrentQuestion(roomCode);
}

// ============================================================
// FINISH GAME
// ============================================================

async function finishGame(roomCode) {
  const room = activeRooms[roomCode];

  if (!room) return;

  if (room.status === "finished" || room.resultsSaved) {
    return;
  }

  clearTimeout(room.questionTimer);

  room.players.forEach((player) => {
    if (!player.hasAnswered) {
      player.wrongAnswers = (player.wrongAnswers || 0) + 1;

      player.hasAnswered = true;
    }
  });

  room.status = "finished";

  const leaderboard = [...room.players]
    .sort((a, b) => {
      return (b.score || 0) - (a.score || 0);
    })
    .map((player, index) => {
      const correctAnswers = Number(player.correctAnswers || 0);

      const wrongAnswers = Number(player.wrongAnswers || 0);

      const totalQuestions = room.questions.length;

      const accuracy =
        totalQuestions > 0
          ? Math.round((correctAnswers / totalQuestions) * 100)
          : 0;

      return {
        rank: index + 1,
        name: player.name,
        score: Number(player.score || 0),
        correctAnswers,
        wrongAnswers,
        accuracy,
      };
    });

  try {
    await pool.query(
      `
        UPDATE rooms
        SET status = 'finished'
        WHERE room_code = ?
      `,
      [roomCode],
    );

    for (const player of leaderboard) {
      await pool.query(
        `
          INSERT INTO results
          (
            room_id,
            player_name,
            score,
            correct_answers,
            wrong_answers,
            rank_position
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          room.roomId,
          player.name,
          player.score,
          player.correctAnswers,
          player.wrongAnswers,
          player.rank,
        ],
      );
    }

    room.resultsSaved = true;
  } catch (error) {
    console.error("SAVE GAME RESULTS ERROR:", error);
  }

  io.to(roomCode).emit("gameFinished", {
    leaderboard,
    totalQuestions: room.questions.length,
    quizTitle: room.quizTitle,
  });

  broadcastRoomState(roomCode);

  console.log(`🏁 Room ${roomCode} finished`);
  console.log("🏆 Final leaderboard:", leaderboard);
}

// ============================================================
// SOCKET.IO
// ============================================================

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  // ========================================================
  // HOST JOIN ROOM
  // ========================================================

  socket.on("hostJoinRoom", ({ roomCode, hostName }) => {
    const room = activeRooms[roomCode];

    if (!room) {
      socket.emit("joinError", "Room tidak ditemukan.");

      return;
    }

    room.host.socketId = socket.id;

    room.host.name = hostName || room.host.name;

    socket.join(roomCode);

    socket.roomCode = roomCode;

    socket.role = "host";

    console.log(`👑 Host ${room.host.name} joined ${roomCode}`);

    socket.emit("joinSuccess", {
      role: "host",
      roomCode,
    });

    broadcastRoomState(roomCode);
  });

  // ========================================================
  // PLAYER JOIN ROOM
  // ========================================================

  socket.on("playerJoinRoom", ({ roomCode, playerName }) => {
    const room = activeRooms[roomCode];

    if (!room) {
      socket.emit("joinError", "Room tidak ditemukan.");

      return;
    }

    if (room.status !== "waiting") {
      socket.emit("joinError", "Game sudah dimulai.");

      return;
    }

    if (!playerName || !playerName.trim()) {
      socket.emit("joinError", "Nickname wajib diisi.");

      return;
    }

    const cleanName = playerName.trim();

    const duplicate = room.players.some(
      (player) => player.name.toLowerCase() === cleanName.toLowerCase(),
    );

    if (duplicate) {
      socket.emit("joinError", "Nickname sudah digunakan.");

      return;
    }

    const player = {
      socketId: socket.id,

      name: cleanName,

      score: 0,

      currentQuestion: 0,

      finished: false,

      hasAnswered: false,

      correctAnswers: 0,

      wrongAnswers: 0,
    };

    room.players.push(player);

    socket.join(roomCode);

    socket.roomCode = roomCode;

    socket.role = "player";

    socket.playerName = cleanName;

    console.log(`👤 Player ${cleanName} joined ${roomCode}`);

    socket.emit("joinSuccess", {
      role: "player",
      roomCode,
      playerName: cleanName,
    });

    broadcastRoomState(roomCode);
  });

  // ========================================================
  // HOST START GAME
  // ========================================================

  socket.on("hostStartGame", async ({ roomCode }) => {
    const room = activeRooms[roomCode];

    if (!room) {
      socket.emit("joinError", "Room tidak ditemukan.");

      return;
    }

    if (room.host.socketId !== socket.id) {
      socket.emit("joinError", "Hanya host yang bisa memulai game.");

      return;
    }

    if (room.status !== "waiting") {
      socket.emit("joinError", "Game sudah dimulai.");

      return;
    }

    if (room.players.length === 0) {
      socket.emit("joinError", "Minimal harus ada 1 player.");

      return;
    }

    try {
      console.log(`🚀 Starting game ${roomCode}`);

      room.questions = await loadQuizQuestions(room.quizId);

      if (room.questions.length === 0) {
        socket.emit("joinError", "Quiz ini belum memiliki pertanyaan.");

        return;
      }

      room.status = "playing";

      room.currentQuestionIndex = 0;

      room.players.forEach((player) => {
        player.score = 0;

        player.currentQuestion = 1;

        player.finished = false;

        player.hasAnswered = false;

        player.correctAnswers = 0;

        player.wrongAnswers = 0;
      });

      await pool.query(
        `
            UPDATE rooms
            SET status = 'playing'
            WHERE room_code = ?
          `,
        [roomCode],
      );

      broadcastRoomState(roomCode);

      setTimeout(() => {
        sendCurrentQuestion(roomCode);
      }, 800);
    } catch (error) {
      console.error("START GAME ERROR:", error);

      socket.emit("joinError", "Gagal memulai game.");
    }
  });

  // ========================================================
  // PLAYER ANSWER
  // ========================================================

  socket.on("submitAnswer", async ({ roomCode, answerId }) => {
    const room = activeRooms[roomCode];

    if (!room) return;

    if (room.status !== "playing") {
      return;
    }

    const player = room.players.find((p) => p.socketId === socket.id);

    if (!player) return;

    if (player.hasAnswered) {
      socket.emit("answerError", "Kamu sudah menjawab.");

      return;
    }

    const question = room.questions[room.currentQuestionIndex];

    if (!question) return;

    const selectedAnswer = question.answers.find(
      (answer) => Number(answer.id) === Number(answerId),
    );

    if (!selectedAnswer) {
      return;
    }

    player.hasAnswered = true;

    const [correctRows] = await pool.query(
      `
            SELECT is_correct
            FROM answers
            WHERE id = ?
            AND question_id = ?
            LIMIT 1
          `,
      [answerId, question.id],
    );

    const isCorrect =
      correctRows.length > 0 && Number(correctRows[0].is_correct) === 1;

    let points = 0;

    if (isCorrect) {
      player.correctAnswers = (player.correctAnswers || 0) + 1;

      const elapsed = Date.now() - room.questionStartedAt;

      const timeLimit = (Number(question.time_limit) || 15) * 1000;

      const remaining = Math.max(0, timeLimit - elapsed);

      points = 1000 + Math.round((remaining / timeLimit) * 1000);

      player.score += points;
    } else {
      player.wrongAnswers = (player.wrongAnswers || 0) + 1;
    }

    socket.emit("answerResult", {
      correct: isCorrect,
      points,
      totalScore: player.score,
    });

    console.log(
      `📝 ${player.name}: ${isCorrect ? "CORRECT" : "WRONG"} +${points}`,
    );

    broadcastRoomState(roomCode);
  });

  // ========================================================
  // DISCONNECT
  // ========================================================

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);

    const roomCode = socket.roomCode;

    if (!roomCode) return;

    const room = activeRooms[roomCode];

    if (!room) return;

    // HOST
    if (socket.role === "host" && room.host.socketId === socket.id) {
      console.log(`👑 Host left room ${roomCode}`);

      io.to(roomCode).emit("hostDisconnected");

      clearTimeout(room.questionTimer);

      delete activeRooms[roomCode];

      return;
    }

    // PLAYER
    const playerIndex = room.players.findIndex(
      (player) => player.socketId === socket.id,
    );

    if (playerIndex !== -1) {
      const player = room.players[playerIndex];

      console.log(`👤 Player ${player.name} left ${roomCode}`);

      room.players.splice(playerIndex, 1);

      broadcastRoomState(roomCode);
    }
  });
});

// ============================================================
// START SERVER
// ============================================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log("");
  console.log("🎮 QUIZZZY SERVER");
  console.log(`🚀 http://localhost:${PORT}`);
  console.log("⚡ Socket.IO enabled");
  console.log("");
  console.log("--------------------------------");

  try {
    const connection = await pool.getConnection();

    console.log("✅ MySQL connected successfully!");

    console.log(`📦 Database: ${process.env.DB_NAME}`);

    connection.release();
  } catch (error) {
    console.error("❌ MySQL connection failed:", error.message);
  }

  console.log("--------------------------------");
});
