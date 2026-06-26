/*
  Quizify - Application Logic (Vanilla JavaScript)
*/

// --- STATE MANAGEMENT ---
const state = {
  theme: 'dark',
  currentIndex: 0,
  score: 0,
  questions: [],
  userAnswers: [], // Keeps log of: { question, choices, chosenAnswer, correctAnswer, isCorrect }
  timerInterval: null,
  timeLeft: 15,
  totalQuestions: 10,
  currentCategory: 'any',
  currentDifficulty: 'any',
  currentType: 'any'
};

// --- DOM ELEMENTS ---
const htmlEl = document.documentElement;
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleIcon = themeToggleBtn.querySelector('i');

// Screens
const welcomeScreen = document.getElementById('welcome-screen');
const loadingScreen = document.getElementById('loading-screen');
const quizScreen = document.getElementById('quiz-screen');
const errorScreen = document.getElementById('error-screen');
const resultsScreen = document.getElementById('results-screen');

// Setup form components
const setupForm = document.getElementById('setup-form');
const categorySelect = document.getElementById('quiz-category');
const amountInput = document.getElementById('quiz-amount');
const amountVal = document.getElementById('amount-val');

// Quiz components
const progressText = document.getElementById('progress-text');
const runningScore = document.getElementById('running-score');
const progressBarFill = document.getElementById('progress-bar-fill');
const categoryBadge = document.getElementById('category-badge');
const timerCountdown = document.getElementById('timer-countdown');
const timerBadge = document.querySelector('.timer-badge');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const quitQuizBtn = document.getElementById('quit-quiz-btn');

// Error screen components
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const errorBackBtn = document.getElementById('error-back-btn');

// Results screen components
const resultPercentage = document.getElementById('result-percentage');
const scoreRing = document.getElementById('score-ring');
const resultFeedback = document.getElementById('result-feedback');
const resultScore = document.getElementById('result-score');
const resultTotal = document.getElementById('result-total');
const playAgainBtn = document.getElementById('play-again-btn');
const reviewToggleBtn = document.getElementById('review-toggle-btn');
const reviewSection = document.getElementById('review-section');
const summaryContainer = document.getElementById('summary-container');

// --- FALLBACK CATEGORIES (Used if the API call fails) ---
const FALLBACK_CATEGORIES = [
  { id: 9, name: "General Knowledge" },
  { id: 10, name: "Entertainment: Books" },
  { id: 11, name: "Entertainment: Film" },
  { id: 12, name: "Entertainment: Music" },
  { id: 13, name: "Entertainment: Musicals & Theatres" },
  { id: 14, name: "Entertainment: Television" },
  { id: 15, name: "Entertainment: Video Games" },
  { id: 16, name: "Entertainment: Board Games" },
  { id: 17, name: "Science & Nature" },
  { id: 18, name: "Science: Computers" },
  { id: 19, name: "Science: Mathematics" },
  { id: 20, name: "Mythology" },
  { id: 21, name: "Sports" },
  { id: 22, name: "Geography" },
  { id: 23, name: "History" },
  { id: 24, name: "Politics" },
  { id: 25, name: "Art" },
  { id: 26, name: "Celebrities" },
  { id: 27, name: "Animals" },
  { id: 28, name: "Vehicles" },
  { id: 29, name: "Entertainment: Comics" },
  { id: 30, name: "Science: Gadgets" },
  { id: 31, name: "Entertainment: Japanese Anime & Manga" },
  { id: 32, name: "Entertainment: Cartoon & Animations" }
];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  fetchCategories();
  
  // Update slider badge text
  amountInput.addEventListener('input', (e) => {
    amountVal.textContent = e.target.value;
  });

  // Setup form submission
  setupForm.addEventListener('submit', handleSetupSubmit);

  // Quit buttons
  quitQuizBtn.addEventListener('click', quitQuiz);
  errorBackBtn.addEventListener('click', showSetupScreen);

  // Results buttons
  playAgainBtn.addEventListener('click', showSetupScreen);
  reviewToggleBtn.addEventListener('click', toggleReviewSection);

  // Retry buttons
  retryBtn.addEventListener('click', () => {
    startQuiz();
  });
});

// --- THEME MANAGEMENT ---
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    state.theme = savedTheme;
  } else {
    // Detect system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    state.theme = prefersDark ? 'dark' : 'light';
  }
  
  applyTheme();
  
  themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    applyTheme();
  });
}

function applyTheme() {
  htmlEl.setAttribute('data-theme', state.theme);
  if (state.theme === 'dark') {
    themeToggleIcon.className = 'fa-solid fa-sun';
  } else {
    themeToggleIcon.className = 'fa-solid fa-moon';
  }
}

// --- SCREEN NAVIGATION ---
function showScreen(screenToShow) {
  const screens = [welcomeScreen, loadingScreen, quizScreen, errorScreen, resultsScreen];
  screens.forEach(screen => {
    screen.classList.remove('active');
  });
  
  // Small timeout to allow styling display/transform transitions to register correctly
  setTimeout(() => {
    screenToShow.classList.add('active');
  }, 50);
}

function showSetupScreen() {
  // Clear any running timers
  clearInterval(state.timerInterval);
  showScreen(welcomeScreen);
}

// --- UTILITY FUNCTIONS ---
function decodeHtml(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

// Shuffling array using Fisher-Yates algorithm
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// --- API ACTIONS ---
async function fetchCategories() {
  try {
    const response = await fetch('https://opentdb.com/api_category.php');
    if (!response.ok) throw new Error('Failed to fetch categories');
    
    const data = await response.json();
    populateCategories(data.trivia_categories);
  } catch (error) {
    console.warn("Categories fetching failed. Loading local backup list.", error);
    populateCategories(FALLBACK_CATEGORIES);
  }
}

function populateCategories(categories) {
  // Clear extra options first (keep default "Any Category")
  categorySelect.innerHTML = '<option value="any">Any Category</option>';
  
  categories.sort((a, b) => a.name.localeCompare(b.name));
  
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    categorySelect.appendChild(option);
  });
}

function handleSetupSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(setupForm);
  state.totalQuestions = parseInt(formData.get('amount'));
  state.currentCategory = formData.get('category');
  state.currentDifficulty = formData.get('difficulty');
  state.currentType = formData.get('type');
  
  startQuiz();
}

async function startQuiz() {
  showScreen(loadingScreen);
  
  // Construct API URL
  let url = `https://opentdb.com/api.php?amount=${state.totalQuestions}`;
  if (state.currentCategory !== 'any') {
    url += `&category=${state.currentCategory}`;
  }
  if (state.currentDifficulty !== 'any') {
    url += `&difficulty=${state.currentDifficulty}`;
  }
  if (state.currentType !== 'any') {
    url += `&type=${state.currentType}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network error. Trivia server did not respond.');
    
    const data = await response.json();
    
    // Response codes details:
    // 0: Success
    // 1: No Results (Quiz params have too many constraints)
    // 2: Invalid Parameter
    // 3: Token Not Found
    // 4: Token Empty (Reset needed)
    if (data.response_code === 0) {
      state.questions = data.results;
      state.currentIndex = 0;
      state.score = 0;
      state.userAnswers = [];
      
      // Close reviews drawer by default
      reviewSection.classList.remove('active');
      reviewSection.classList.add('collapsed');
      reviewToggleBtn.innerHTML = '<i class="fa-solid fa-list-check"></i> Show Review';
      
      // Load first question
      loadQuestion();
      showScreen(quizScreen);
    } else if (data.response_code === 1) {
      throw new Error("No questions found for the combination chosen. Please choose a different category or difficulty level.");
    } else {
      throw new Error("Unable to fetch questions. The trivia server returned an error code: " + data.response_code);
    }
  } catch (error) {
    console.error(error);
    errorMessage.textContent = error.message || "We couldn't connect to the trivia server. Check your connection and try again.";
    showScreen(errorScreen);
  }
}

// --- QUIZ EXECUTION ENGINE ---
function loadQuestion() {
  // Clear any existing active timers
  clearInterval(state.timerInterval);
  
  const question = state.questions[state.currentIndex];
  
  // Update progress elements
  progressText.textContent = `Question ${state.currentIndex + 1} of ${state.questions.length}`;
  runningScore.textContent = state.score;
  
  const percentComplete = ((state.currentIndex + 1) / state.questions.length) * 100;
  progressBarFill.style.width = `${percentComplete}%`;
  
  // Set meta details
  categoryBadge.textContent = decodeHtml(question.category);
  categoryBadge.title = decodeHtml(question.category);
  
  // Render decoded question text
  questionText.textContent = decodeHtml(question.question);
  
  // Setup answer choice choices
  let choices = [];
  if (question.type === 'boolean') {
    choices = ['True', 'False'];
  } else {
    // Shuffling correct answer with incorrect choices
    choices = shuffleArray([question.correct_answer, ...question.incorrect_answers]);
  }
  
  // Render answer buttons
  optionsContainer.innerHTML = '';
  choices.forEach(choice => {
    const decodedChoice = decodeHtml(choice);
    const button = document.createElement('button');
    button.className = 'option-btn';
    button.type = 'button';
    button.innerHTML = `
      <span>${decodedChoice}</span>
      <div class="option-indicator"><i class="fa-solid fa-check"></i></div>
    `;
    
    // Attach selection listener
    button.addEventListener('click', () => handleAnswerSelect(decodedChoice, button));
    optionsContainer.appendChild(button);
  });
  
  // Initialize timer
  startTimer();
}

function startTimer() {
  state.timeLeft = 15;
  timerCountdown.textContent = state.timeLeft;
  timerBadge.classList.remove('warning');
  
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    timerCountdown.textContent = state.timeLeft;
    
    if (state.timeLeft <= 5) {
      timerBadge.classList.add('warning');
    }
    
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      handleTimerTimeout();
    }
  }, 1000);
}

function handleAnswerSelect(selectedAnswer, selectedBtn) {
  // Stop countdown
  clearInterval(state.timerInterval);
  
  const currentQuestionObj = state.questions[state.currentIndex];
  const decodedCorrectAnswer = decodeHtml(currentQuestionObj.correct_answer);
  const isCorrect = (selectedAnswer === decodedCorrectAnswer);
  
  // Highlight correctness
  const buttons = optionsContainer.querySelectorAll('.option-btn');
  buttons.forEach(btn => {
    btn.disabled = true; // Prevent multiple clicks
    
    const btnText = btn.querySelector('span').textContent;
    if (btnText === decodedCorrectAnswer) {
      btn.classList.add('correct');
      btn.querySelector('.option-indicator').innerHTML = '<i class="fa-solid fa-check"></i>';
    } else if (btn === selectedBtn && !isCorrect) {
      btn.classList.add('incorrect');
      btn.querySelector('.option-indicator').innerHTML = '<i class="fa-solid fa-xmark"></i>';
    }
  });

  if (isCorrect) {
    state.score++;
    runningScore.textContent = state.score;
  }
  
  // Record answer history log
  state.userAnswers.push({
    question: decodeHtml(currentQuestionObj.question),
    choices: optionsContainer.querySelectorAll('.option-btn span'), // reference of rendering
    chosenAnswer: selectedAnswer,
    correctAnswer: decodedCorrectAnswer,
    isCorrect: isCorrect,
    timedOut: false
  });
  
  // Move to next question after short delay
  transitionToNext();
}

function handleTimerTimeout() {
  const currentQuestionObj = state.questions[state.currentIndex];
  const decodedCorrectAnswer = decodeHtml(currentQuestionObj.correct_answer);
  
  // Disable option buttons and highlight correct answer in green
  const buttons = optionsContainer.querySelectorAll('.option-btn');
  buttons.forEach(btn => {
    btn.disabled = true;
    const btnText = btn.querySelector('span').textContent;
    if (btnText === decodedCorrectAnswer) {
      btn.classList.add('correct');
      btn.querySelector('.option-indicator').innerHTML = '<i class="fa-solid fa-check"></i>';
    }
  });
  
  // Record timer expiry in user logs
  state.userAnswers.push({
    question: decodeHtml(currentQuestionObj.question),
    chosenAnswer: "[Time Expired]",
    correctAnswer: decodedCorrectAnswer,
    isCorrect: false,
    timedOut: true
  });
  
  transitionToNext();
}

function transitionToNext() {
  setTimeout(() => {
    state.currentIndex++;
    if (state.currentIndex < state.questions.length) {
      loadQuestion();
    } else {
      endQuiz();
    }
  }, 2000);
}

function quitQuiz() {
  if (confirm("Are you sure you want to quit the quiz? Your current progress will be lost.")) {
    showSetupScreen();
  }
}

// --- RESULTS DISPLAY ---
function endQuiz() {
  clearInterval(state.timerInterval);
  
  // Calculate percentage
  const total = state.questions.length;
  const percentage = Math.round((state.score / total) * 100);
  
  // Render results
  resultScore.textContent = state.score;
  resultTotal.textContent = total;
  resultPercentage.textContent = `${percentage}%`;
  
  // Radial Score Ring Animation
  // Circumference = 2 * Math.PI * r = 2 * 3.14159 * 70 = 439.82 (approx 440)
  const circumference = 440;
  const strokeOffset = circumference - (percentage / 100) * circumference;
  scoreRing.style.strokeDashoffset = strokeOffset;
  
  // Score ratings and feedback text
  let feedbackText = '';
  if (percentage === 100) {
    feedbackText = "Perfect Score! 🏆 You're a Genius!";
  } else if (percentage >= 80) {
    feedbackText = "Outstanding Job! 🌟 You nailed it!";
  } else if (percentage >= 60) {
    feedbackText = "Good Job! 👍 You have great knowledge!";
  } else if (percentage >= 40) {
    feedbackText = "Not Bad! 🙂 Keep practicing to improve!";
  } else {
    feedbackText = "Keep Learning! 📚 Every try makes you smarter!";
  }
  resultFeedback.textContent = feedbackText;
  
  // Generate review summary items
  generateBreakdownList();
  
  showScreen(resultsScreen);
}

function generateBreakdownList() {
  summaryContainer.innerHTML = '';
  
  state.userAnswers.forEach((ans, idx) => {
    const item = document.createElement('div');
    item.className = `review-item ${ans.isCorrect ? 'correct-item' : 'incorrect-item'}`;
    
    // Set text elements safely
    const qText = document.createElement('div');
    qText.className = 'review-q-text';
    qText.textContent = `${idx + 1}. ${ans.question}`;
    
    const ansRow = document.createElement('div');
    ansRow.className = 'review-answers-row';
    
    // User answer label & value
    const userChoiceRow = document.createElement('div');
    userChoiceRow.className = `review-ans ${ans.isCorrect ? 'user-choice-correct' : 'user-choice-incorrect'}`;
    
    const userChoiceLabel = document.createElement('span');
    userChoiceLabel.className = 'review-label';
    userChoiceLabel.textContent = 'Your Answer:';
    
    const userChoiceVal = document.createElement('span');
    userChoiceVal.textContent = ans.timedOut ? "⌛ [Time Expired]" : ans.chosenAnswer;
    
    userChoiceRow.appendChild(userChoiceLabel);
    userChoiceRow.appendChild(userChoiceVal);
    
    ansRow.appendChild(userChoiceRow);
    
    // Correct Answer label & value (rendered if incorrect/timedout)
    if (!ans.isCorrect) {
      const correctChoiceRow = document.createElement('div');
      correctChoiceRow.className = 'review-ans correct-choice';
      
      const correctChoiceLabel = document.createElement('span');
      correctChoiceLabel.className = 'review-label';
      correctChoiceLabel.textContent = 'Correct:';
      
      const correctChoiceVal = document.createElement('span');
      correctChoiceVal.textContent = ans.correctAnswer;
      
      correctChoiceRow.appendChild(correctChoiceLabel);
      correctChoiceRow.appendChild(correctChoiceVal);
      ansRow.appendChild(correctChoiceRow);
    }
    
    item.appendChild(qText);
    item.appendChild(ansRow);
    summaryContainer.appendChild(item);
  });
}

function toggleReviewSection() {
  const isCollapsed = reviewSection.classList.contains('collapsed');
  
  if (isCollapsed) {
    reviewSection.classList.remove('collapsed');
    reviewSection.classList.add('active');
    reviewToggleBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Hide Review';
    
    // Scroll down to the review section smoothly
    setTimeout(() => {
      reviewSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 150);
  } else {
    reviewSection.classList.remove('active');
    reviewSection.classList.add('collapsed');
    reviewToggleBtn.innerHTML = '<i class="fa-solid fa-list-check"></i> Show Review';
  }
}
