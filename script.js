// ============================================================
// QUIZZZY CLIENT
// Multiplayer + Solo + Quiz Creator + Audio
// ============================================================

const socket = io();

// ============================================================
// STATE
// ============================================================

let role = null;
let roomCode = null;
let playerName = null;
let quizTitle = "";

let currentQuestion = 0;
let totalQuestions = 0;
let currentTimeLimit = 15;

let timerInterval = null;
let hasAnswered = false;

let latestPlayers = [];
let myScore = 0;

// ============================================================
// SOLO
// ============================================================

let soloMode = false;
let soloQuestions = [];
let soloQuestionIndex = 0;
let soloScore = 0;
let soloCorrect = 0;
let soloWrong = 0;
let soloAnswered = false;
let soloTimerInterval = null;

// ============================================================
// AUDIO
// ============================================================

let musicVolume = Number(localStorage.getItem("quizzzyMusicVolume") ?? 50);

let sfxVolume = Number(localStorage.getItem("quizzzySfxVolume") ?? 60);

let audioMuted = localStorage.getItem("quizzzyAudioMuted") === "true";

const backgroundMusic = document.getElementById("backgroundMusic");

// ============================================================
// ELEMENTS
// ============================================================

const screens = {
  home: document.getElementById("homeScreen"),
  create: document.getElementById("createScreen"),
  join: document.getElementById("joinScreen"),
  soloSetup: document.getElementById("soloSetupScreen"),
  createQuiz: document.getElementById("createQuizScreen"),
  lobby: document.getElementById("lobbyScreen"),
  game: document.getElementById("gameScreen"),
  result: document.getElementById("resultScreen"),
};

const showCreateBtn = document.getElementById("showCreateBtn");

const showJoinBtn = document.getElementById("showJoinBtn");

const showSoloBtn = document.getElementById("showSoloBtn");

const showCreateQuizBtn = document.getElementById("showCreateQuizBtn");

const backFromCreateBtn = document.getElementById("backFromCreateBtn");

const backFromJoinBtn = document.getElementById("backFromJoinBtn");

const backFromSoloBtn = document.getElementById("backFromSoloBtn");

const backFromCreateQuizBtn = document.getElementById("backFromCreateQuizBtn");

const hostNameInput = document.getElementById("hostName");

const quizSelect = document.getElementById("quizSelect");

const createRoomBtn = document.getElementById("createRoomBtn");

const createError = document.getElementById("createError");

const roomCodeInput = document.getElementById("roomCodeInput");

const playerNameInput = document.getElementById("playerName");

const joinGameBtn = document.getElementById("joinGameBtn");

const joinError = document.getElementById("joinError");

const soloPlayerNameInput = document.getElementById("soloPlayerName");

const soloQuizSelect = document.getElementById("soloQuizSelect");

const startSoloBtn = document.getElementById("startSoloBtn");

const soloError = document.getElementById("soloError");

const creatorQuizTitle = document.getElementById("creatorQuizTitle");

const creatorQuizDescription = document.getElementById(
  "creatorQuizDescription",
);

const addQuestionBtn = document.getElementById("addQuestionBtn");

const creatorQuestions = document.getElementById("creatorQuestions");

const saveQuizBtn = document.getElementById("saveQuizBtn");

const creatorMessage = document.getElementById("creatorMessage");

const homeQuizList = document.getElementById("homeQuizList");

const lobbyQuizTitle = document.getElementById("lobbyQuizTitle");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");

const playerCount = document.getElementById("playerCount");

const playersList = document.getElementById("playersList");

const hostControls = document.getElementById("hostControls");

const startGameBtn = document.getElementById("startGameBtn");

const lobbyMessage = document.getElementById("lobbyMessage");

const playerWaiting = document.getElementById("playerWaiting");

const gameQuizTitle = document.getElementById("gameQuizTitle");

const questionCounter = document.getElementById("questionCounter");

const timerDisplay = document.getElementById("timerDisplay");

const questionProgressBar = document.getElementById("questionProgressBar");

const questionText = document.getElementById("questionText");

const answersGrid = document.getElementById("answersGrid");

const answerStatus = document.getElementById("answerStatus");

const resultEyebrow = document.getElementById("resultEyebrow");

const resultTitle = document.getElementById("resultTitle");

const leaderboard = document.getElementById("leaderboard");

const backHomeBtn = document.getElementById("backHomeBtn");

const soloResultSummary = document.getElementById("soloResultSummary");

const soloFinalScore = document.getElementById("soloFinalScore");

const soloCorrectCount = document.getElementById("soloCorrectCount");

const soloWrongCount = document.getElementById("soloWrongCount");

const soloAccuracy = document.getElementById("soloAccuracy");

// ============================================================
// AUDIO ELEMENTS
// ============================================================

const audioToggleBtn = document.getElementById("audioToggleBtn");

const audioPanel = document.getElementById("audioPanel");

const closeAudioPanelBtn = document.getElementById("closeAudioPanelBtn");

const musicVolumeSlider = document.getElementById("musicVolumeSlider");

const sfxVolumeSlider = document.getElementById("sfxVolumeSlider");

const musicVolumeValue = document.getElementById("musicVolumeValue");

const sfxVolumeValue = document.getElementById("sfxVolumeValue");

const muteAudioBtn = document.getElementById("muteAudioBtn");

// ============================================================
// SCREEN
// ============================================================

function showScreen(name) {
  Object.values(screens).forEach((screen) => {
    if (screen) {
      screen.classList.add("hidden");
    }
  });

  if (screens[name]) {
    screens[name].classList.remove("hidden");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initializeAudio();

  showScreen("home");

  loadQuizzes();
});

// ============================================================
// NAVIGATION
// ============================================================

showCreateBtn?.addEventListener("click", () => {
  clearMessage(createError);

  showScreen("create");

  loadQuizzes();
});

showJoinBtn?.addEventListener("click", () => {
  clearMessage(joinError);

  showScreen("join");
});

showSoloBtn?.addEventListener("click", () => {
  clearMessage(soloError);

  showScreen("soloSetup");

  loadSoloQuizzes();
});

showCreateQuizBtn?.addEventListener("click", () => {
  clearCreator();

  showScreen("createQuiz");

  if (creatorQuestions && creatorQuestions.children.length === 0) {
    addQuestion();
  }
});

backFromCreateBtn?.addEventListener("click", () => {
  showScreen("home");
});

backFromJoinBtn?.addEventListener("click", () => {
  showScreen("home");
});

backFromSoloBtn?.addEventListener("click", () => {
  resetSoloState();

  showScreen("home");
});

backFromCreateQuizBtn?.addEventListener("click", () => {
  showScreen("home");
});

backHomeBtn?.addEventListener("click", () => {
  stopBackgroundMusic();

  resetSoloState();

  resetClientState();

  if (soloResultSummary) {
    soloResultSummary.classList.add("hidden");
  }

  if (resultEyebrow) {
    resultEyebrow.textContent = "GAME FINISHED";
  }

  if (resultTitle) {
    resultTitle.textContent = "🏆 Final Leaderboard";
  }

  showScreen("home");

  loadQuizzes();
});

// ============================================================
// QUIZ LIST
// ============================================================

async function fetchQuizzes() {
  const response = await fetch("/api/quizzes");

  if (!response.ok) {
    throw new Error("Gagal mengambil daftar quiz.");
  }

  const quizzes = await response.json();

  return Array.isArray(quizzes) ? quizzes : [];
}

// ============================================================
// LOAD QUIZZES
// ============================================================

async function loadQuizzes() {
  if (quizSelect) {
    quizSelect.innerHTML = `
      <option value="">
        Loading quizzes...
      </option>
    `;
  }

  try {
    const quizzes = await fetchQuizzes();

    if (quizSelect) {
      quizSelect.innerHTML = `
        <option value="">
          ${quizzes.length ? "Pilih quiz..." : "Belum ada quiz"}
        </option>
      `;

      quizzes.forEach((quiz) => {
        const option = document.createElement("option");

        option.value = quiz.id;

        option.textContent = `${quiz.title} (${quiz.question_count || 0} questions)`;

        quizSelect.appendChild(option);
      });
    }

    renderHomeQuizList(quizzes);
  } catch (error) {
    console.error("LOAD QUIZZES ERROR:", error);

    if (quizSelect) {
      quizSelect.innerHTML = `
        <option value="">
          Gagal mengambil quiz
        </option>
      `;
    }

    if (homeQuizList) {
      homeQuizList.innerHTML = `
        <div class="waiting-text">
          Gagal mengambil quiz.
        </div>
      `;
    }
  }
}

// ============================================================
// LOAD SOLO QUIZZES
// ============================================================

async function loadSoloQuizzes() {
  if (!soloQuizSelect) {
    return;
  }

  soloQuizSelect.innerHTML = `
    <option value="">
      Loading quizzes...
    </option>
  `;

  try {
    const quizzes = await fetchQuizzes();

    soloQuizSelect.innerHTML = `
      <option value="">
        ${quizzes.length ? "Pilih quiz..." : "Belum ada quiz"}
      </option>
    `;

    quizzes.forEach((quiz) => {
      const option = document.createElement("option");

      option.value = quiz.id;

      option.textContent = `${quiz.title} (${quiz.question_count || 0} questions)`;

      soloQuizSelect.appendChild(option);
    });
  } catch (error) {
    console.error("LOAD SOLO QUIZZES ERROR:", error);

    soloQuizSelect.innerHTML = `
      <option value="">
        Gagal mengambil quiz
      </option>
    `;
  }
}

// ============================================================
// HOME QUIZ LIST
// ============================================================

function renderHomeQuizList(quizzes) {
  if (!homeQuizList) {
    return;
  }

  homeQuizList.innerHTML = "";

  if (!quizzes.length) {
    homeQuizList.innerHTML = `
      <div class="home-empty">
        <strong>Belum ada quiz</strong>
        <span>
          Buat quiz pertama kamu melalui Quiz Creator.
        </span>
      </div>
    `;

    return;
  }

  quizzes.slice(0, 6).forEach((quiz) => {
    const card = document.createElement("div");

    card.className = "home-quiz-card";

    card.innerHTML = `
      <div class="home-quiz-icon">
        Q
      </div>

      <div class="home-quiz-info">
        <strong>
          ${escapeHtml(quiz.title)}
        </strong>

        <span>
          ${Number(quiz.question_count || 0)}
          questions
        </span>
      </div>
    `;

    homeQuizList.appendChild(card);
  });
}

// ============================================================
// CREATE ROOM
// ============================================================

createRoomBtn?.addEventListener("click", async () => {
  clearMessage(createError);

  const hostName = hostNameInput.value.trim();

  const quizId = quizSelect.value;

  if (!hostName) {
    showError(createError, "Nama host wajib diisi.");

    hostNameInput.focus();

    return;
  }

  if (!quizId) {
    showError(createError, "Pilih quiz terlebih dahulu.");

    quizSelect.focus();

    return;
  }

  createRoomBtn.disabled = true;

  createRoomBtn.textContent = "Creating...";

  try {
    const response = await fetch("/api/rooms", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        quizId: Number(quizId),
        hostName,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Gagal membuat room.");
    }

    role = "host";

    roomCode = data.room.roomCode;

    playerName = hostName;

    quizTitle = data.room.quizTitle;

    lobbyQuizTitle.textContent = quizTitle;

    roomCodeDisplay.textContent = roomCode;

    hostControls.classList.remove("hidden");

    playerWaiting.classList.add("hidden");

    showScreen("lobby");

    socket.emit("hostJoinRoom", {
      roomCode,
      hostName,
    });
  } catch (error) {
    console.error("CREATE ROOM ERROR:", error);

    showError(createError, error.message || "Gagal membuat room.");
  } finally {
    createRoomBtn.disabled = false;

    createRoomBtn.textContent = "Create Room";
  }
});

// ============================================================
// JOIN ROOM
// ============================================================

joinGameBtn?.addEventListener("click", () => {
  clearMessage(joinError);

  const code = roomCodeInput.value.trim().toUpperCase();

  const name = playerNameInput.value.trim();

  if (code.length !== 6) {
    showError(joinError, "Room code harus 6 karakter.");

    roomCodeInput.focus();

    return;
  }

  if (!name) {
    showError(joinError, "Nickname wajib diisi.");

    playerNameInput.focus();

    return;
  }

  role = "player";

  roomCode = code;

  playerName = name;

  joinGameBtn.disabled = true;

  joinGameBtn.textContent = "Joining...";

  socket.emit("playerJoinRoom", {
    roomCode,
    playerName,
  });
});

// ============================================================
// INPUT
// ============================================================

roomCodeInput?.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
});

playerNameInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    joinGameBtn?.click();
  }
});

hostNameInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    createRoomBtn?.click();
  }
});

// ============================================================
// SOLO START
// ============================================================

startSoloBtn?.addEventListener("click", async () => {
  clearMessage(soloError);

  const name = soloPlayerNameInput.value.trim();

  const quizId = soloQuizSelect.value;

  if (!name) {
    showError(soloError, "Nama wajib diisi.");

    soloPlayerNameInput.focus();

    return;
  }

  if (!quizId) {
    showError(soloError, "Pilih quiz terlebih dahulu.");

    soloQuizSelect.focus();

    return;
  }

  startSoloBtn.disabled = true;

  startSoloBtn.textContent = "Loading...";

  try {
    const response = await fetch(`/api/quizzes/${Number(quizId)}`);

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Gagal mengambil soal quiz.");
    }

    if (!Array.isArray(data.questions) || !data.questions.length) {
      throw new Error("Quiz ini belum memiliki pertanyaan.");
    }

    soloMode = true;

    role = "player";

    playerName = name;

    quizTitle = data.quiz?.title || "Solo Quiz";

    soloQuestions = data.questions;

    soloQuestionIndex = 0;

    soloScore = 0;

    soloCorrect = 0;

    soloWrong = 0;

    soloAnswered = false;

    showScreen("game");

    startBackgroundMusic();

    renderSoloQuestion();
  } catch (error) {
    console.error("START SOLO ERROR:", error);

    showError(soloError, error.message || "Gagal memulai solo quiz.");
  } finally {
    startSoloBtn.disabled = false;

    startSoloBtn.textContent = "Start Solo Quiz";
  }
});

// ============================================================
// SOLO QUESTION
// ============================================================

function renderSoloQuestion() {
  if (!soloMode) {
    return;
  }

  const question = soloQuestions[soloQuestionIndex];

  if (!question) {
    finishSoloGame();

    return;
  }

  stopTimer();

  stopSoloTimer();

  soloAnswered = false;

  currentQuestion = soloQuestionIndex + 1;

  totalQuestions = soloQuestions.length;

  currentTimeLimit = Number(question.time_limit) || 15;

  gameQuizTitle.textContent = quizTitle || "SOLO QUIZ";

  questionCounter.textContent = `Question ${currentQuestion} / ${totalQuestions}`;

  timerDisplay.textContent = currentTimeLimit;

  questionText.textContent = question.question || "Question unavailable.";

  answerStatus.textContent = "";

  answerStatus.className = "answer-status";

  answersGrid.innerHTML = "";

  updateQuestionProgress(currentTimeLimit);

  const answers = Array.isArray(question.answers) ? question.answers : [];

  answers.forEach((answer, index) => {
    const button = document.createElement("button");

    button.type = "button";

    button.className = "answer-button";

    const letter = document.createElement("span");

    letter.className = "answer-letter";

    letter.textContent = String.fromCharCode(65 + index);

    const text = document.createElement("span");

    text.textContent = answer.answer_text || "";

    button.appendChild(letter);

    button.appendChild(text);

    button.addEventListener("click", () => {
      submitSoloAnswer(answer, button);
    });

    answersGrid.appendChild(button);
  });

  showScreen("game");

  startSoloTimer(currentTimeLimit);
}

// ============================================================
// SOLO TIMER
// ============================================================

function startSoloTimer(seconds) {
  stopSoloTimer();

  let remaining = Number(seconds) || 15;

  timerDisplay.textContent = remaining;

  updateQuestionProgress(remaining);

  soloTimerInterval = setInterval(() => {
    remaining--;

    timerDisplay.textContent = Math.max(remaining, 0);

    updateQuestionProgress(remaining);

    if (remaining <= 0) {
      stopSoloTimer();

      if (!soloAnswered) {
        submitSoloAnswer(null, null, true);
      }
    }
  }, 1000);
}

function stopSoloTimer() {
  if (soloTimerInterval) {
    clearInterval(soloTimerInterval);

    soloTimerInterval = null;
  }
}

// ============================================================
// SOLO ANSWER
// ============================================================

function submitSoloAnswer(answer, clickedButton, timedOut = false) {
  if (!soloMode || soloAnswered) {
    return;
  }

  soloAnswered = true;

  stopSoloTimer();

  stopTimer();

  disableAnswers();

  if (clickedButton) {
    clickedButton.classList.add("selected");
  }

  const correct = !timedOut && answer && Number(answer.is_correct) === 1;

  if (correct) {
    soloCorrect++;

    soloScore += 1000;

    answerStatus.textContent = "✓ Correct! +1000 points";

    answerStatus.className = "answer-status correct";

    playSound("correct");
  } else {
    soloWrong++;

    answerStatus.textContent = timedOut ? "Time's up!" : "✕ Wrong answer";

    answerStatus.className = "answer-status wrong";

    if (!timedOut) {
      playSound("wrong");
    }
  }

  setTimeout(() => {
    if (!soloMode) {
      return;
    }

    soloQuestionIndex++;

    if (soloQuestionIndex >= soloQuestions.length) {
      finishSoloGame();
    } else {
      renderSoloQuestion();
    }
  }, 700);
}

// ============================================================
// SOLO RESULT
// ============================================================

function finishSoloGame() {
  stopSoloTimer();

  stopTimer();

  stopBackgroundMusic();

  const total = soloQuestions.length;

  const accuracy = total > 0 ? Math.round((soloCorrect / total) * 100) : 0;

  soloResultSummary?.classList.remove("hidden");

  if (soloFinalScore) {
    soloFinalScore.textContent = `${soloScore} pts`;
  }

  if (soloCorrectCount) {
    soloCorrectCount.textContent = soloCorrect;
  }

  if (soloWrongCount) {
    soloWrongCount.textContent = soloWrong;
  }

  if (soloAccuracy) {
    soloAccuracy.textContent = `${accuracy}%`;
  }

  resultEyebrow.textContent = "SOLO QUIZ";

  resultTitle.textContent = "🎯 Your Result";

  leaderboard.innerHTML = "";

  const item = document.createElement("div");

  item.className = "leaderboard-item first";

  item.innerHTML = `
    <div class="leaderboard-rank">
      🏆
    </div>

    <div class="leaderboard-name">
      ${escapeHtml(playerName || "Player")}
    </div>

    <div class="leaderboard-score">
      ${soloScore} pts
    </div>
  `;

  leaderboard.appendChild(item);

  showScreen("result");
}

// ============================================================
// HOST START GAME
// ============================================================

startGameBtn?.addEventListener("click", () => {
  if (!roomCode) {
    return;
  }

  startGameBtn.disabled = true;

  startGameBtn.textContent = "Starting...";

  socket.emit("hostStartGame", {
    roomCode,
  });
});

// ============================================================
// SOCKET CONNECT
// ============================================================

socket.on("connect", () => {
  console.log("⚡ Socket connected:", socket.id);
});

// ============================================================
// JOIN SUCCESS
// ============================================================

socket.on("joinSuccess", (data) => {
  console.log("✅ Join success:", data);

  if (data.role) {
    role = data.role;
  }

  if (data.roomCode) {
    roomCode = data.roomCode;
  }

  if (data.playerName) {
    playerName = data.playerName;
  }

  if (role === "player" && joinGameBtn) {
    joinGameBtn.disabled = false;

    joinGameBtn.textContent = "Join Game";

    showScreen("lobby");
  }
});

// ============================================================
// JOIN ERROR
// ============================================================

socket.on("joinError", (message) => {
  console.error("JOIN ERROR:", message);

  if (joinGameBtn) {
    joinGameBtn.disabled = false;

    joinGameBtn.textContent = "Join Game";
  }

  if (startGameBtn) {
    startGameBtn.disabled = false;

    startGameBtn.textContent = "Start Game";
  }

  if (role === "player") {
    showError(joinError, message);
  } else {
    showError(createError, message);

    showError(lobbyMessage, message);
  }
});

// ============================================================
// ROOM STATE
// ============================================================

socket.on("roomState", (state) => {
  if (!state) {
    return;
  }

  roomCode = state.roomCode || roomCode;

  latestPlayers = Array.isArray(state.players) ? state.players : [];

  if (state.host?.name && role === "host") {
    playerName = state.host.name;
  }

  roomCodeDisplay.textContent = roomCode || "------";

  renderPlayers(latestPlayers);

  if (state.status === "waiting") {
    showScreen("lobby");

    if (role === "host") {
      hostControls.classList.remove("hidden");

      playerWaiting.classList.add("hidden");

      lobbyMessage.textContent =
        latestPlayers.length > 0
          ? `${latestPlayers.length} player ready.`
          : "Waiting for players...";

      startGameBtn.disabled = latestPlayers.length === 0;

      startGameBtn.textContent = "Start Game";
    } else {
      hostControls.classList.add("hidden");

      playerWaiting.classList.remove("hidden");
    }

    return;
  }

  if (state.status === "playing") {
    updateLiveLeaderboard(latestPlayers);

    const me = latestPlayers.find(
      (player) => role === "player" && player.name === playerName,
    );

    if (me) {
      myScore = Number(me.score || 0);
    }
  }
});

// ============================================================
// RENDER PLAYERS
// ============================================================

function renderPlayers(players) {
  if (!playersList) {
    return;
  }

  playerCount.textContent = `${players.length} ${
    players.length === 1 ? "player" : "players"
  }`;

  playersList.innerHTML = "";

  if (!players.length) {
    playersList.innerHTML = `
      <div class="waiting-text">
        Belum ada player yang bergabung.
      </div>
    `;

    return;
  }

  players.forEach((player) => {
    const item = document.createElement("div");

    item.className = "player-item";

    const avatar = document.createElement("div");

    avatar.className = "player-avatar";

    avatar.textContent = (player.name || "?").charAt(0).toUpperCase();

    const name = document.createElement("div");

    name.className = "player-name";

    name.textContent = player.name || "Unknown";

    item.appendChild(avatar);

    item.appendChild(name);

    playersList.appendChild(item);
  });
}

// ============================================================
// GAME QUESTION
// ============================================================

socket.on("gameQuestion", (data) => {
  if (soloMode) {
    return;
  }

  currentQuestion = Number(data.questionNumber) || 1;

  totalQuestions = Number(data.totalQuestions) || 1;

  currentTimeLimit = Number(data.timeLimit) || 15;

  hasAnswered = false;

  gameQuizTitle.textContent = quizTitle || "QUIZZZY";

  questionCounter.textContent = `Question ${currentQuestion} / ${totalQuestions}`;

  updateQuestionProgress();

  startBackgroundMusic();

  // ========================================================
  // HOST
  // ========================================================

  if (role === "host") {
    stopTimer();

    showScreen("game");

    questionText.textContent = "Game sedang berlangsung";

    answersGrid.innerHTML = `
        <div class="host-live-panel">

          <h3>
            👑 Host Mode
          </h3>

          <p>
            Kamu sedang memantau jalannya game.
          </p>

          <div class="host-live-status">
            LIVE
          </div>

          <div class="player-live-panel">

            <div class="player-live-score">
              Question
              ${currentQuestion}
              /
              ${totalQuestions}
            </div>

            <p>
              Tunggu player menjawab pertanyaan ini.
            </p>

          </div>

        </div>
      `;

    answerStatus.textContent = "Host sedang memantau jawaban player.";

    answerStatus.className = "answer-status";

    updateLiveLeaderboard(latestPlayers);

    return;
  }

  // ========================================================
  // PLAYER
  // ========================================================

  questionText.textContent = data.question || "Question unavailable.";

  answerStatus.textContent = "";

  answerStatus.className = "answer-status";

  answersGrid.innerHTML = "";

  const answers = Array.isArray(data.answers) ? data.answers : [];

  answers.forEach((answer, index) => {
    const button = document.createElement("button");

    button.type = "button";

    button.className = "answer-button";

    const letter = document.createElement("span");

    letter.className = "answer-letter";

    letter.textContent = String.fromCharCode(65 + index);

    const text = document.createElement("span");

    text.textContent = answer.answer_text || "";

    button.appendChild(letter);

    button.appendChild(text);

    button.addEventListener("click", () => {
      submitAnswer(answer.id, button);
    });

    answersGrid.appendChild(button);
  });

  showScreen("game");

  startTimer(currentTimeLimit);
});

// ============================================================
// SUBMIT ANSWER
// ============================================================

function submitAnswer(answerId, clickedButton) {
  if (role !== "player") {
    return;
  }

  if (hasAnswered) {
    return;
  }

  hasAnswered = true;

  stopTimer();

  disableAnswers();

  if (clickedButton) {
    clickedButton.classList.add("selected");
  }

  answerStatus.textContent = "Jawaban dikirim...";

  answerStatus.className = "answer-status";

  socket.emit("submitAnswer", {
    roomCode,
    answerId,
  });
}

// ============================================================
// ANSWER RESULT
// ============================================================

socket.on("answerResult", (data) => {
  myScore = Number(data.totalScore) || 0;

  if (data.correct) {
    answerStatus.textContent = `✓ Correct! +${data.points} points`;

    answerStatus.className = "answer-status correct";

    playSound("correct");
  } else {
    answerStatus.textContent = "✕ Wrong answer";

    answerStatus.className = "answer-status wrong";

    playSound("wrong");
  }
});

// ============================================================
// TIMEOUT
// ============================================================

socket.on("questionTimeout", () => {
  stopTimer();

  if (!hasAnswered && role === "player") {
    hasAnswered = true;

    disableAnswers();

    answerStatus.textContent = "Time's up!";

    answerStatus.className = "answer-status wrong";
  }
});

// ============================================================
// TIMER
// ============================================================

function startTimer(seconds) {
  stopTimer();

  let remaining = Number(seconds) || 15;

  timerDisplay.textContent = remaining;

  updateQuestionProgress(remaining);

  timerInterval = setInterval(() => {
    remaining--;

    timerDisplay.textContent = Math.max(remaining, 0);

    updateQuestionProgress(remaining);

    if (remaining <= 0) {
      stopTimer();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);

    timerInterval = null;
  }
}

function updateQuestionProgress(remaining = currentTimeLimit) {
  if (!questionProgressBar) {
    return;
  }

  const total = Number(currentTimeLimit) || 15;

  const value = Math.max(0, Math.min(100, (remaining / total) * 100));

  questionProgressBar.style.width = `${value}%`;
}

// ============================================================
// DISABLE ANSWERS
// ============================================================

function disableAnswers() {
  document.querySelectorAll(".answer-button").forEach((button) => {
    button.disabled = true;

    button.classList.add("disabled");
  });
}

// ============================================================
// LIVE LEADERBOARD
// ============================================================

function ensureLiveLeaderboard() {
  let panel = document.getElementById("liveLeaderboardPanel");

  if (panel) {
    return panel;
  }

  panel = document.createElement("div");

  panel.id = "liveLeaderboardPanel";

  panel.className = "live-leaderboard";

  panel.innerHTML = `
    <div class="live-leaderboard-header">

      <div>
        <h3>
          Live Leaderboard
        </h3>

        <span>
          Ranking sementara
        </span>
      </div>

      <div class="host-live-status">
        LIVE
      </div>

    </div>

    <div
      id="liveLeaderboardList"
      class="live-leaderboard-list"
    ></div>
  `;

  const gameContainer = document.querySelector(".game-container");

  if (gameContainer) {
    gameContainer.appendChild(panel);
  }

  return panel;
}

function updateLiveLeaderboard(players) {
  const panel = ensureLiveLeaderboard();

  if (!panel) {
    return;
  }

  const list = document.getElementById("liveLeaderboardList");

  if (!list) {
    return;
  }

  const sorted = [...players].sort(
    (a, b) => Number(b.score || 0) - Number(a.score || 0),
  );

  list.innerHTML = "";

  if (!sorted.length) {
    list.innerHTML = `
      <div class="waiting-text">
        Belum ada player.
      </div>
    `;

    return;
  }

  sorted.forEach((player, index) => {
    const rank = index + 1;

    const item = document.createElement("div");

    item.className = "live-rank-item";

    if (rank === 1) {
      item.classList.add("rank-1");
    }

    if (rank === 2) {
      item.classList.add("rank-2");
    }

    if (rank === 3) {
      item.classList.add("rank-3");
    }

    if (role === "player" && player.name === playerName) {
      item.classList.add("current-player");
    }

    item.innerHTML = `
        <div class="live-rank-position">
          ${rank}
        </div>

        <div class="live-rank-info">

          <div class="live-rank-name">
            ${escapeHtml(player.name || "Unknown")}
          </div>

          <div class="live-rank-progress">
            ${
              player.finished
                ? "Finished"
                : `Question ${
                    player.currentQuestion || currentQuestion
                  }/${totalQuestions}`
            }
          </div>

        </div>

        <div class="live-rank-score">
          ${Number(player.score || 0)} pts
        </div>
      `;

    list.appendChild(item);
  });
}

// ============================================================
// GAME FINISHED
// ============================================================

socket.on("gameFinished", (data) => {
  if (soloMode) {
    return;
  }

  stopTimer();

  stopBackgroundMusic();

  const finalLeaderboard = Array.isArray(data.leaderboard)
    ? data.leaderboard
    : [];

  soloResultSummary?.classList.add("hidden");

  resultEyebrow.textContent = "GAME FINISHED";

  resultTitle.textContent = "🏆 Final Leaderboard";

  renderFinalLeaderboard(finalLeaderboard);

  showScreen("result");
});

// ============================================================
// FINAL LEADERBOARD
// ============================================================

function renderFinalLeaderboard(players) {
  leaderboard.innerHTML = "";

  if (!players.length) {
    leaderboard.innerHTML = `
      <div class="waiting-text">
        Belum ada hasil.
      </div>
    `;

    return;
  }

  players.forEach((player) => {
    const item = document.createElement("div");

    item.className = "leaderboard-item";

    if (player.rank === 1) {
      item.classList.add("first");
    }

    if (player.rank === 2) {
      item.classList.add("second");
    }

    if (player.rank === 3) {
      item.classList.add("third");
    }

    item.innerHTML = `
        <div class="leaderboard-rank">
          ${player.rank === 1 ? "🏆" : player.rank}
        </div>

        <div class="leaderboard-name">
          ${escapeHtml(player.name || "Unknown")}
        </div>

        <div class="leaderboard-score">
          ${Number(player.score || 0)} pts
        </div>
      `;

    leaderboard.appendChild(item);
  });
}

// ============================================================
// HOST DISCONNECTED
// ============================================================

socket.on("hostDisconnected", () => {
  stopTimer();

  stopBackgroundMusic();

  alert("Host meninggalkan game. Room telah ditutup.");

  resetClientState();

  showScreen("home");
});

// ============================================================
// ANSWER ERROR
// ============================================================

socket.on("answerError", (message) => {
  answerStatus.textContent = message || "Gagal mengirim jawaban.";

  answerStatus.className = "answer-status wrong";
});

// ============================================================
// QUIZ CREATOR
// ============================================================

let creatorQuestionCount = 0;

function addQuestion() {
  if (!creatorQuestions) {
    return;
  }

  creatorQuestionCount++;

  const number = creatorQuestionCount;

  const card = document.createElement("div");

  card.className = "creator-question-card";

  card.dataset.question = number;

  card.innerHTML = `
    <div class="question-top">

      <div>
        <span class="question-number">
          QUESTION ${number}
        </span>

        <h3>
          Question ${number}
        </h3>
      </div>

      <button
        type="button"
        class="remove-question"
        data-remove-question
      >
        Remove
      </button>

    </div>

    <div class="form-group">
      <label>
        Question
      </label>

      <textarea
        class="creator-question-input"
        maxlength="500"
        placeholder="Tulis pertanyaan..."
      ></textarea>
    </div>

    <div class="creator-answer-list">

      ${createAnswerInput("A", true)}

      ${createAnswerInput("B", false)}

      ${createAnswerInput("C", false)}

      ${createAnswerInput("D", false)}

    </div>

    <div class="form-group creator-time-group">
      <label>
        Time Limit
      </label>

      <select class="creator-time-input">
        <option value="10">
          10 seconds
        </option>

        <option value="15" selected>
          15 seconds
        </option>

        <option value="20">
          20 seconds
        </option>

        <option value="30">
          30 seconds
        </option>

        <option value="45">
          45 seconds
        </option>

        <option value="60">
          60 seconds
        </option>
      </select>
    </div>
  `;

  const removeButton = card.querySelector("[data-remove-question]");

  removeButton.addEventListener("click", () => {
    card.remove();

    renumberCreatorQuestions();
  });

  creatorQuestions.appendChild(card);
}

function createAnswerInput(letter, checked) {
  return `
    <div class="creator-answer-row">

      <span class="creator-answer-letter">
        ${letter}
      </span>

      <input
        type="text"
        class="creator-answer-input"
        data-answer="${letter}"
        placeholder="Answer ${letter}"
        maxlength="200"
      />

      <label class="creator-correct">
        <input
          type="radio"
          name="correct-${creatorQuestionCount}"
          value="${letter}"
          ${checked ? "checked" : ""}
        />

        <span>
          Correct
        </span>
      </label>

    </div>
  `;
}

function renumberCreatorQuestions() {
  if (!creatorQuestions) {
    return;
  }

  const cards = creatorQuestions.querySelectorAll(".creator-question-card");

  cards.forEach((card, index) => {
    const number = index + 1;

    card.dataset.question = number;

    const numberLabel = card.querySelector(".question-number");

    const title = card.querySelector(".question-top h3");

    if (numberLabel) {
      numberLabel.textContent = `QUESTION ${number}`;
    }

    if (title) {
      title.textContent = `Question ${number}`;
    }

    const radios = card.querySelectorAll('input[type="radio"]');

    radios.forEach((radio) => {
      radio.name = `correct-${number}`;
    });
  });

  creatorQuestionCount = cards.length;
}

addQuestionBtn?.addEventListener("click", () => {
  addQuestion();
});

saveQuizBtn?.addEventListener("click", saveQuiz);

async function saveQuiz() {
  clearCreatorMessage();

  const title = creatorQuizTitle?.value.trim();

  const description = creatorQuizDescription?.value.trim();

  const cards = creatorQuestions?.querySelectorAll(".creator-question-card");

  if (!title) {
    showCreatorMessage("Quiz title wajib diisi.", true);

    creatorQuizTitle?.focus();

    return;
  }

  if (!cards || cards.length === 0) {
    showCreatorMessage("Tambahkan minimal 1 pertanyaan.", true);

    return;
  }

  const questions = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];

    const questionInput = card.querySelector(".creator-question-input");

    const answerInputs = card.querySelectorAll(".creator-answer-input");

    const correctRadio = card.querySelector('input[type="radio"]:checked');

    const question = questionInput?.value.trim();

    if (!question) {
      showCreatorMessage(`Question ${i + 1} belum diisi.`, true);

      questionInput?.focus();

      return;
    }

    if (!correctRadio) {
      showCreatorMessage(`Pilih jawaban benar untuk Question ${i + 1}.`, true);

      return;
    }

    const answers = [];

    let incomplete = false;

    answerInputs.forEach((input) => {
      const value = input.value.trim();

      if (!value) {
        incomplete = true;
      }

      answers.push({
        answer_text: value,
        is_correct: correctRadio.value === input.dataset.answer,
      });
    });

    if (incomplete) {
      showCreatorMessage(
        `Semua pilihan jawaban Question ${i + 1} wajib diisi.`,
        true,
      );

      return;
    }

    const timeInput = card.querySelector(".creator-time-input");

    questions.push({
      question,
      time_limit: Number(timeInput?.value) || 15,
      answers,
    });
  }

  saveQuizBtn.disabled = true;

  saveQuizBtn.textContent = "Saving...";

  try {
    const response = await fetch("/api/quizzes", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        title,
        description,
        questions,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Gagal menyimpan quiz.");
    }

    showCreatorMessage("✓ Quiz berhasil dibuat!", false);

    await loadQuizzes();

    setTimeout(() => {
      clearCreator();

      showScreen("home");

      loadQuizzes();
    }, 900);
  } catch (error) {
    console.error("SAVE QUIZ ERROR:", error);

    showCreatorMessage(error.message || "Gagal menyimpan quiz.", true);
  } finally {
    saveQuizBtn.disabled = false;

    saveQuizBtn.textContent = "Save Quiz";
  }
}

function clearCreator() {
  creatorQuestionCount = 0;

  if (creatorQuizTitle) {
    creatorQuizTitle.value = "";
  }

  if (creatorQuizDescription) {
    creatorQuizDescription.value = "";
  }

  if (creatorQuestions) {
    creatorQuestions.innerHTML = "";
  }

  clearCreatorMessage();
}

function showCreatorMessage(message, error) {
  if (!creatorMessage) {
    return;
  }

  creatorMessage.textContent = message;

  creatorMessage.className = error
    ? "creator-message error"
    : "creator-message success";
}

function clearCreatorMessage() {
  if (!creatorMessage) {
    return;
  }

  creatorMessage.textContent = "";

  creatorMessage.className = "creator-message";
}

// ============================================================
// AUDIO SYSTEM
// ============================================================

function initializeAudio() {
  musicVolume = clampVolume(musicVolume);

  sfxVolume = clampVolume(sfxVolume);

  if (musicVolumeSlider) {
    musicVolumeSlider.value = musicVolume;
  }

  if (sfxVolumeSlider) {
    sfxVolumeSlider.value = sfxVolume;
  }

  updateAudioUI();

  if (backgroundMusic) {
    backgroundMusic.volume = musicVolume / 100;
  }
}

function clampVolume(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function startBackgroundMusic() {
  if (!backgroundMusic) {
    return;
  }

  backgroundMusic.volume = audioMuted ? 0 : musicVolume / 100;

  if (audioMuted) {
    return;
  }

  backgroundMusic.play().catch(() => {
    // Browser membutuhkan user gesture.
  });
}

function stopBackgroundMusic() {
  if (!backgroundMusic) {
    return;
  }

  backgroundMusic.pause();

  backgroundMusic.currentTime = 0;
}

function playSound(type) {
  if (audioMuted) {
    return;
  }

  let src = "";

  if (type === "correct") {
    src = "/assets/audio/correct.mp3";
  }

  if (type === "wrong") {
    src = "/assets/audio/wrong.mp3";
  }

  if (!src) {
    return;
  }

  const audio = new Audio(src);

  audio.volume = sfxVolume / 100;

  audio.play().catch(() => {
    // Browser dapat memblokir audio.
  });
}

audioToggleBtn?.addEventListener("click", () => {
  audioPanel?.classList.toggle("hidden");
});

closeAudioPanelBtn?.addEventListener("click", () => {
  audioPanel?.classList.add("hidden");
});

musicVolumeSlider?.addEventListener("input", () => {
  musicVolume = clampVolume(musicVolumeSlider.value);

  localStorage.setItem("quizzzyMusicVolume", musicVolume);

  if (backgroundMusic) {
    backgroundMusic.volume = audioMuted ? 0 : musicVolume / 100;
  }

  updateAudioUI();
});

sfxVolumeSlider?.addEventListener("input", () => {
  sfxVolume = clampVolume(sfxVolumeSlider.value);

  localStorage.setItem("quizzzySfxVolume", sfxVolume);

  updateAudioUI();
});

muteAudioBtn?.addEventListener("click", () => {
  audioMuted = !audioMuted;

  localStorage.setItem("quizzzyAudioMuted", audioMuted);

  if (backgroundMusic) {
    backgroundMusic.volume = audioMuted ? 0 : musicVolume / 100;
  }

  updateAudioUI();
});

function updateAudioUI() {
  if (musicVolumeValue) {
    musicVolumeValue.textContent = `${musicVolume}%`;
  }

  if (sfxVolumeValue) {
    sfxVolumeValue.textContent = `${sfxVolume}%`;
  }

  if (muteAudioBtn) {
    muteAudioBtn.textContent = audioMuted ? "🔊 Unmute All" : "🔇 Mute All";
  }

  if (audioToggleBtn) {
    audioToggleBtn.textContent = audioMuted ? "🔇" : "🔊";
  }
}

// ============================================================
// RESET SOLO
// ============================================================

function resetSoloState() {
  stopSoloTimer();

  soloMode = false;

  soloQuestions = [];

  soloQuestionIndex = 0;

  soloScore = 0;

  soloCorrect = 0;

  soloWrong = 0;

  soloAnswered = false;

  if (soloError) {
    clearMessage(soloError);
  }

  soloResultSummary?.classList.add("hidden");

  if (soloFinalScore) {
    soloFinalScore.textContent = "0";
  }

  if (soloCorrectCount) {
    soloCorrectCount.textContent = "0";
  }

  if (soloWrongCount) {
    soloWrongCount.textContent = "0";
  }

  if (soloAccuracy) {
    soloAccuracy.textContent = "0%";
  }
}

// ============================================================
// RESET CLIENT
// ============================================================

function resetClientState() {
  stopTimer();

  stopSoloTimer();

  stopBackgroundMusic();

  role = null;

  roomCode = null;

  playerName = null;

  quizTitle = "";

  currentQuestion = 0;

  totalQuestions = 0;

  currentTimeLimit = 15;

  hasAnswered = false;

  latestPlayers = [];

  myScore = 0;

  if (answersGrid) {
    answersGrid.innerHTML = "";
  }

  if (leaderboard) {
    leaderboard.innerHTML = "";
  }

  const livePanel = document.getElementById("liveLeaderboardPanel");

  if (livePanel) {
    livePanel.remove();
  }

  if (startGameBtn) {
    startGameBtn.disabled = false;

    startGameBtn.textContent = "Start Game";
  }
}

// ============================================================
// HELPERS
// ============================================================

function showError(element, message) {
  if (!element) {
    return;
  }

  element.textContent = message || "";

  element.classList.add("show");
}

function clearMessage(element) {
  if (!element) {
    return;
  }

  element.textContent = "";

  element.classList.remove("show");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// CONNECTION
// ============================================================

socket.on("connect_error", (error) => {
  console.error("❌ Socket connection error:", error);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Socket disconnected:", reason);
});
