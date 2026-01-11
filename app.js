// Application State
const state = {
    practicedVerbs: new Set(),
    currentVerb: null,
    currentStep: 0, // 0: preterit, 1: participle, 2: french
    correctAnswers: 0,
    incorrectAnswers: 0,
    currentSessionCorrect: 0,
    currentSessionIncorrect: 0,
    // Training mode
    trainingMode: false,
    trainingQueue: [],
    missedVerbs: [],
    trainingConfig: {
        verbCount: 10,
        timerEnabled: false,
        timerDuration: 15
    },
    timerInterval: null,
    currentTimer: 0,
    customMode: false,
    selectedCustomVerbs: new Set(),
    // Multiplayer mode
    multiplayerMode: false,
    // Progress tracking
    verbsCompletedInSession: 0
};

// Elements
const selectionView = document.getElementById('selection-view');
const practiceView = document.getElementById('practice-view');
const verbsGrid = document.getElementById('verbs-grid');
const searchInput = document.getElementById('search-input');
const totalVerbsEl = document.getElementById('total-verbs');
const practicedCountEl = document.getElementById('practiced-count');
const successRateEl = document.getElementById('success-rate');
const backButton = document.getElementById('back-button');
const currentVerbEl = document.getElementById('current-verb');
const verbBaseEl = document.getElementById('verb-base');
const questionTitleEl = document.getElementById('question-title');
const answerInput = document.getElementById('answer-input');
const submitButton = document.getElementById('submit-button');
const feedbackEl = document.getElementById('feedback');
const progressFill = document.getElementById('progress-fill');
const correctCountEl = document.getElementById('correct-count');
const incorrectCountEl = document.getElementById('incorrect-count');

// Training mode elements
const trainingModeButton = document.getElementById('training-mode-button');
const trainingOverlay = document.getElementById('training-overlay');
const overlayClose = document.getElementById('overlay-close');
const verbCountInput = document.getElementById('verb-count');
const decreaseCountBtn = document.getElementById('decrease-count');
const increaseCountBtn = document.getElementById('increase-count');
const quickBtns = document.querySelectorAll('.quick-btn');
const timerToggle = document.getElementById('timer-toggle');
const timerConfig = document.getElementById('timer-config');
const timerDurationInput = document.getElementById('timer-duration');
const decreaseTimerBtn = document.getElementById('decrease-timer');
const increaseTimerBtn = document.getElementById('increase-timer');
const startTrainingBtn = document.getElementById('start-training');
const customModeToggle = document.getElementById('custom-mode-toggle');
const randomModeConfig = document.getElementById('random-mode-config');
const customVerbsConfig = document.getElementById('custom-verbs-config');
const customVerbsGrid = document.getElementById('custom-verbs-grid');
const customSearch = document.getElementById('custom-search');
const selectedCountEl = document.getElementById('selected-count');

// Questions for each step
const questions = [
    "Quel est le prétérit de ce verbe ?",
    "Quel est le participe passé ?",
    "Quelle est la traduction en français ?"
];

// Initialize
function init() {
    renderVerbsGrid();
    updateStats();
    loadProgress();

    // Event listeners
    searchInput.addEventListener('input', filterVerbs);
    backButton.addEventListener('click', handleBackButton);
    submitButton.addEventListener('click', checkAnswer);
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkAnswer();
        }
    });

    // Training mode listeners
    trainingModeButton.addEventListener('click', openTrainingOverlay);
    overlayClose.addEventListener('click', closeTrainingOverlay);
    trainingOverlay.addEventListener('click', (e) => {
        if (e.target === trainingOverlay) closeTrainingOverlay();
    });

    decreaseCountBtn.addEventListener('click', () => adjustNumber(verbCountInput, -1, 1, 115));
    increaseCountBtn.addEventListener('click', () => adjustNumber(verbCountInput, 1, 1, 115));
    decreaseTimerBtn.addEventListener('click', () => adjustNumber(timerDurationInput, -1, 5, 60));
    increaseTimerBtn.addEventListener('click', () => adjustNumber(timerDurationInput, 1, 5, 60));

    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const count = parseInt(btn.dataset.count);
            verbCountInput.value = count;
            quickBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    timerToggle.addEventListener('change', () => {
        timerConfig.classList.toggle('hidden', !timerToggle.checked);
    });

    customModeToggle.addEventListener('change', () => {
        state.customMode = customModeToggle.checked;
        randomModeConfig.classList.toggle('hidden', customModeToggle.checked);
        customVerbsConfig.classList.toggle('hidden', !customModeToggle.checked);

        // Hide/show the main verb selection grid
        verbsGrid.classList.toggle('hidden', customModeToggle.checked);

        if (customModeToggle.checked) {
            renderCustomVerbsGrid();
        }
    });

    customSearch.addEventListener('input', () => {
        renderCustomVerbsGrid();
    });

    startTrainingBtn.addEventListener('click', startTrainingMode);

    // Profile listeners
    const saveProfileBtn = document.getElementById('save-profile');
    const profileUsernameInput = document.getElementById('profile-username');
    const editProfileBtn = document.getElementById('edit-profile-btn');

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            const username = profileUsernameInput.value.trim();
            if (username.length >= 3 && username.length <= 15) {
                ProfileManager.save(username);
                hideProfileOverlay();
                updateProfileDisplay();
            } else {
                alert('Le pseudo doit contenir entre 3 et 15 caractères');
            }
        });

        profileUsernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveProfileBtn.click();
            }
        });
    }

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            const overlay = document.getElementById('profile-overlay');
            const input = document.getElementById('profile-username');
            if (overlay && input) {
                input.value = ProfileManager.getUsername();
                overlay.classList.add('active');
            }
        });
    }

    // Multiplayer listeners
    const multiplayerButton = document.getElementById('multiplayer-button');
    const multiplayerClose = document.getElementById('multiplayer-close');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const confirmJoinBtn = document.getElementById('confirm-join');
    const waitingRoomClose = document.getElementById('waiting-room-close');
    const startMultiGameBtn = document.getElementById('start-multi-game');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const closePodiumBtn = document.getElementById('close-podium');

    if (multiplayerButton) {
        multiplayerButton.addEventListener('click', () => {
            closeTrainingOverlay();
            showMultiplayerOptions();
        });
    }

    if (multiplayerClose) {
        multiplayerClose.addEventListener('click', () => {
            hideMultiplayerOptions();
        });
    }

    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', async () => {
            let count = parseInt(verbCountInput.value) || 10;
            let customVerbsList = null;

            if (state.customMode) {
                // In custom mode, use selected verbs
                customVerbsList = irregularVerbs.filter(v => state.selectedCustomVerbs.has(v.base));
                count = customVerbsList.length;

                if (count === 0) {
                    alert('Veuillez sélectionner au moins un verbe en mode personnalisé.');
                    return;
                }
            }

            const config = {
                verbCount: count,
                timerEnabled: timerToggle.checked,
                timerDuration: parseInt(timerDurationInput.value) || 15,
                customVerbs: customVerbsList
            };
            try {
                await MultiplayerManager.createRoom(config);
            } catch (error) {
                alert('Erreur de connexion au serveur. Vérifiez que le serveur est lancé.');
            }
        });
    }

    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', () => {
            const joinForm = document.getElementById('join-room-form');
            const options = document.querySelector('.multiplayer-options');
            if (joinForm && options) {
                options.classList.add('hidden');
                joinForm.classList.remove('hidden');
            }
        });
    }

    if (confirmJoinBtn) {
        confirmJoinBtn.addEventListener('click', async () => {
            const codeInput = document.getElementById('join-code-input');
            const code = codeInput.value.trim().toUpperCase();
            if (code.length === 6) {
                try {
                    await MultiplayerManager.joinRoom(code);
                } catch (error) {
                    alert('Erreur de connexion au serveur.');
                }
            } else {
                alert('Le code doit contenir 6 caractères');
            }
        });
    }

    if (waitingRoomClose) {
        waitingRoomClose.addEventListener('click', () => {
            MultiplayerManager.leaveRoom();
            const overlay = document.getElementById('waiting-room-overlay');
            if (overlay) overlay.classList.remove('active');
        });
    }

    if (startMultiGameBtn) {
        startMultiGameBtn.addEventListener('click', () => {
            MultiplayerManager.startGame();
        });
    }

    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', () => {
            const code = document.getElementById('room-code-display').textContent;
            navigator.clipboard.writeText(code).then(() => {
                copyCodeBtn.textContent = '✓ Copié!';
                setTimeout(() => {
                    copyCodeBtn.textContent = '📋 Copier';
                }, 2000);
            });
        });
    }

    if (closePodiumBtn) {
        closePodiumBtn.addEventListener('click', () => {
            hidePodium();
        });
    }
}

// Training Mode Functions
function openTrainingOverlay() {
    trainingOverlay.classList.add('active');
}

function closeTrainingOverlay() {
    trainingOverlay.classList.remove('active');
}

function adjustNumber(input, delta, min, max) {
    let value = parseInt(input.value) || min;
    value += delta;
    value = Math.max(min, Math.min(max, value));
    input.value = value;
}

function renderCustomVerbsGrid() {
    const searchQuery = customSearch.value.toLowerCase().trim();

    const filteredVerbs = searchQuery
        ? irregularVerbs.filter(verb =>
            verb.base.toLowerCase().includes(searchQuery) ||
            verb.french.toLowerCase().includes(searchQuery)
        )
        : irregularVerbs;

    customVerbsGrid.innerHTML = '';

    filteredVerbs.forEach(verb => {
        const item = document.createElement('div');
        item.className = 'custom-verb-item';

        if (state.selectedCustomVerbs.has(verb.base)) {
            item.classList.add('selected');
        }

        item.innerHTML = `
            <div class="verb-name-small">${verb.base}</div>
            <div class="verb-translation-small">${verb.french}</div>
        `;

        item.addEventListener('click', () => {
            if (state.selectedCustomVerbs.has(verb.base)) {
                state.selectedCustomVerbs.delete(verb.base);
                item.classList.remove('selected');
            } else {
                state.selectedCustomVerbs.add(verb.base);
                item.classList.add('selected');
            }
            updateSelectedCount();
        });

        customVerbsGrid.appendChild(item);
    });

    updateSelectedCount();
}

function updateSelectedCount() {
    selectedCountEl.textContent = state.selectedCustomVerbs.size;
}

function startTrainingMode() {
    // Get configuration
    state.trainingConfig.verbCount = parseInt(verbCountInput.value) || 10;
    state.trainingConfig.timerEnabled = timerToggle.checked;
    state.trainingConfig.timerDuration = parseInt(timerDurationInput.value) || 15;

    // Validate custom mode
    if (state.customMode && state.selectedCustomVerbs.size === 0) {
        alert('⚠️ Veuillez sélectionner au moins un verbe !');
        return;
    }

    // Reset training state
    state.trainingMode = true;
    state.missedVerbs = [];
    state.currentSessionCorrect = 0;
    state.currentSessionIncorrect = 0;
    state.verbsCompletedInSession = 0;

    // Get verbs based on mode
    if (state.customMode) {
        // Use custom selected verbs
        state.trainingQueue = irregularVerbs.filter(verb =>
            state.selectedCustomVerbs.has(verb.base)
        );
        // Shuffle them
        state.trainingQueue.sort(() => Math.random() - 0.5);
    } else {
        // Shuffle and get random verbs
        const shuffled = [...irregularVerbs].sort(() => Math.random() - 0.5);
        state.trainingQueue = shuffled.slice(0, state.trainingConfig.verbCount);
    }

    closeTrainingOverlay();

    // Start first verb
    if (state.trainingQueue.length > 0) {
        startNextTrainingVerb();
    }
}

function startNextTrainingVerb() {
    // Check if we have verbs in queue
    if (state.trainingQueue.length === 0) {
        // Check if we have missed verbs to retry
        if (state.missedVerbs.length > 0) {
            state.trainingQueue = [...state.missedVerbs];
            state.missedVerbs = [];
        } else {
            // Training complete!
            endTrainingMode();
            return;
        }
    }

    // Get next verb
    const verb = state.trainingQueue.shift();
    state.currentVerb = verb;
    state.currentStep = 0;

    showPracticeView();
    updatePracticeUI();

    // Start timer if enabled
    if (state.trainingConfig.timerEnabled) {
        startTimer();
    }
}

function startTimer() {
    // Clear any existing timer
    stopTimer();

    // Add timer display if not exists
    let timerDisplay = document.querySelector('.timer-display');
    if (!timerDisplay) {
        timerDisplay = document.createElement('div');
        timerDisplay.className = 'timer-display';
        document.querySelector('.practice-card').appendChild(timerDisplay);
    }

    state.currentTimer = state.trainingConfig.timerDuration;
    updateTimerDisplay(timerDisplay);

    state.timerInterval = setInterval(() => {
        state.currentTimer--;
        updateTimerDisplay(timerDisplay);

        // Warning when 5 seconds left
        if (state.currentTimer <= 5) {
            timerDisplay.classList.add('warning');
        }

        // Time's up!
        if (state.currentTimer <= 0) {
            stopTimer();
            handleTimerExpired();
        }
    }, 1000);
}

function updateTimerDisplay(timerDisplay) {
    timerDisplay.textContent = `${state.currentTimer}s`;
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }

    const timerDisplay = document.querySelector('.timer-display');
    if (timerDisplay) {
        timerDisplay.classList.remove('warning');
    }
}

function handleTimerExpired() {
    // Add to missed verbs
    if (!state.missedVerbs.find(v => v.base === state.currentVerb.base)) {
        state.missedVerbs.push(state.currentVerb);
    }

    state.incorrectAnswers++;
    state.currentSessionIncorrect++;
    updateStats();

    showFeedback(false, getCurrentCorrectAnswer());

    setTimeout(() => {
        moveToNextInTraining();
    }, 1500);
}

function getCurrentCorrectAnswer() {
    switch (state.currentStep) {
        case 0: return state.currentVerb.preterit;
        case 1: return state.currentVerb.participle;
        case 2: return state.currentVerb.french;
    }
}

function moveToNextInTraining() {
    stopTimer();
    state.currentStep = 0; // Reset to first step for next verb
    startNextTrainingVerb();
}

function endTrainingMode() {
    stopTimer();

    // Remove timer display
    const timerDisplay = document.querySelector('.timer-display');
    if (timerDisplay) {
        timerDisplay.remove();
    }

    state.trainingMode = false;

    // If multiplayer mode, notify server and wait for podium
    if (state.multiplayerMode) {
        const score = {
            correct: state.currentSessionCorrect,
            incorrect: state.currentSessionIncorrect
        };
        // Ensure progress bar is full
        progressFill.style.width = '100%';
        MultiplayerManager.playerFinished(score);
        feedbackEl.className = 'feedback correct show';
        feedbackEl.textContent = `Vous avez terminé ! En attente des autres joueurs...`;
        return;
    }

    // Ensure progress bar is full for solo mode too
    progressFill.style.width = '100%';
    feedbackEl.className = 'feedback correct show';
    feedbackEl.textContent = `Entraînement terminé ! Score: ${state.currentSessionCorrect}/${state.currentSessionCorrect + state.currentSessionIncorrect}`;

    setTimeout(() => {
        showSelectionView();
    }, 3000);
}

function handleBackButton() {
    if (state.trainingMode) {
        // Ask for confirmation
        if (confirm('Voulez-vous vraiment quitter le mode entraînement ?')) {
            stopTimer();
            const timerDisplay = document.querySelector('.timer-display');
            if (timerDisplay) {
                timerDisplay.remove();
            }
            state.trainingMode = false;
            state.trainingQueue = [];
            state.missedVerbs = [];
            showSelectionView();
        }
    } else {
        showSelectionView();
    }
}

// Render verbs grid
function renderVerbsGrid(verbs = irregularVerbs) {
    verbsGrid.innerHTML = '';

    verbs.forEach((verb, index) => {
        const card = document.createElement('div');
        card.className = 'verb-card';
        if (state.practicedVerbs.has(verb.base)) {
            card.classList.add('practiced');
        }

        card.innerHTML = `
            <div class="verb-card-header">
                <div class="verb-name">${verb.base}</div>
                ${state.practicedVerbs.has(verb.base) ? '<div class="practice-badge">✓ Pratiqué</div>' : ''}
            </div>
            <div class="verb-translation">${verb.french}</div>
            <div class="verb-forms">
                <span class="verb-form">Prétérit: ${verb.preterit}</span>
                <span class="verb-form">P.P.: ${verb.participle}</span>
            </div>
        `;

        card.addEventListener('click', () => startPractice(verb));
        verbsGrid.appendChild(card);
    });
}

// Filter verbs based on search
function filterVerbs() {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
        renderVerbsGrid();
        return;
    }

    const filtered = irregularVerbs.filter(verb =>
        verb.base.toLowerCase().includes(query) ||
        verb.french.toLowerCase().includes(query) ||
        verb.preterit.toLowerCase().includes(query) ||
        verb.participle.toLowerCase().includes(query)
    );

    renderVerbsGrid(filtered);
}

// Update statistics
function updateStats() {
    totalVerbsEl.textContent = irregularVerbs.length;
    practicedCountEl.textContent = state.practicedVerbs.size;

    const totalAttempts = state.correctAnswers + state.incorrectAnswers;
    const successRate = totalAttempts > 0
        ? Math.round((state.correctAnswers / totalAttempts) * 100)
        : 0;
    successRateEl.textContent = `${successRate}%`;
}

// Start practice for a verb
function startPractice(verb) {
    state.currentVerb = verb;
    state.currentStep = 0;
    state.currentSessionCorrect = 0;
    state.currentSessionIncorrect = 0;
    state.verbsCompletedInSession = 0;

    showPracticeView();
    updatePracticeUI();
}

// Show practice view
function showPracticeView() {
    selectionView.classList.remove('active');
    practiceView.classList.add('active');
    answerInput.focus();
}

// Show selection view
function showSelectionView() {
    practiceView.classList.remove('active');
    selectionView.classList.add('active');
    searchInput.value = '';
    renderVerbsGrid();
}

// Update practice UI
function updatePracticeUI() {
    currentVerbEl.textContent = state.currentVerb.base;
    // Hide french translation during test as requested
    verbBaseEl.textContent = '';
    questionTitleEl.textContent = questions[state.currentStep];
    answerInput.value = '';
    feedbackEl.className = 'feedback';
    feedbackEl.textContent = '';

    // Update progress bar
    if (state.trainingMode) {
        const totalVerbs = state.trainingConfig.verbCount;
        // Calculate progress based on actually COMPLETED verbs (successes), not queue position
        // This ensures failed verbs (pushed to end) don't advance the bar
        const progress = (state.verbsCompletedInSession / totalVerbs) * 100;
        progressFill.style.width = `${progress}%`;

        // Send progress update for multiplayer
        if (state.multiplayerMode && typeof MultiplayerManager !== 'undefined') {
            MultiplayerManager.updateProgress(progress, state.verbsCompletedInSession);
        }
    } else {
        const progress = (state.currentStep / 3) * 100;
        progressFill.style.width = `${progress}%`;
    }

    // Update session stats
    correctCountEl.textContent = state.currentSessionCorrect;
    incorrectCountEl.textContent = state.currentSessionIncorrect;

    answerInput.focus();
}

// Normalize answer for comparison (handles case insensitivity and accents)
function normalizeAnswer(answer) {
    return answer.trim().toLowerCase()
        .replace(/[àâä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[îï]/g, 'i')
        .replace(/[ôö]/g, 'o')
        .replace(/[ùûü]/g, 'u')
        .replace(/ç/g, 'c');
}

// Check if answers match (handles variations like "was/were", "got/gotten")
function answersMatch(userAnswer, correctAnswer) {
    const normalizedUser = normalizeAnswer(userAnswer);
    const normalizedCorrect = normalizeAnswer(correctAnswer);

    // If correct answer has variations (e.g., "was/were")
    if (normalizedCorrect.includes('/')) {
        const variations = normalizedCorrect.split('/');
        return variations.some(variation =>
            normalizedUser === variation.trim() ||
            normalizedUser.includes(variation.trim())
        );
    }

    return normalizedUser === normalizedCorrect;
}

// Check answer
function checkAnswer() {
    const userAnswer = answerInput.value.trim();
    if (!userAnswer) {
        return;
    }

    let correctAnswer;
    switch (state.currentStep) {
        case 0:
            correctAnswer = state.currentVerb.preterit;
            break;
        case 1:
            correctAnswer = state.currentVerb.participle;
            break;
        case 2:
            correctAnswer = state.currentVerb.french;
            break;
    }

    const isCorrect = answersMatch(userAnswer, correctAnswer);

    if (isCorrect) {
        showFeedback(true, correctAnswer);
        state.correctAnswers++;
        state.currentSessionCorrect++;

        // Move to next step after delay
        setTimeout(() => {
            state.currentStep++;

            if (state.trainingMode) {
                // In training mode, move to next verb after all 3 steps
                if (state.currentStep >= 3) {
                    state.practicedVerbs.add(state.currentVerb.base);
                    state.verbsCompletedInSession++; // Increment progress only on success
                    saveProgress();
                    moveToNextInTraining();
                } else {
                    // Restart timer for next question
                    if (state.trainingConfig.timerEnabled) {
                        startTimer();
                    }
                    updatePracticeUI();
                }
            } else {
                // Normal mode
                if (state.currentStep >= 3) {
                    state.practicedVerbs.add(state.currentVerb.base);
                    saveProgress();
                    showCompletionMessage();
                } else {
                    updatePracticeUI();
                }
            }
        }, 1500);
    } else {
        showFeedback(false, correctAnswer);
        state.incorrectAnswers++;
        state.currentSessionIncorrect++;

        if (state.trainingMode) {
            // Add the full verb object to missed verbs for later retry
            if (!state.missedVerbs.find(v => v.base === state.currentVerb.base)) {
                state.missedVerbs.push(state.currentVerb);
            }

            // Whether solo or multiplayer, move to next verb.
            // Expected behavior:
            // 1. Verb added to missedVerbs (already done above)
            // 2. Progress bar DOES NOT advance (handled by verbsCompletedInSession check)
            // 3. Move to next verb in queue
            // 4. Missed verbs come back at the end
            setTimeout(() => {
                state.currentStep = 0;
                moveToNextInTraining();
            }, 2000);
        } else {
            // Allow retry in normal mode
            setTimeout(() => {
                feedbackEl.className = 'feedback';
                answerInput.value = '';
                answerInput.focus();
            }, 2000);
        }
    }

    updateStats();
}

// Show feedback
function showFeedback(isCorrect, correctAnswer) {
    feedbackEl.className = `feedback ${isCorrect ? 'correct' : 'incorrect'} show`;

    if (isCorrect) {
        const messages = [
            'Parfait !',
            'Excellent !',
            'Bravo !',
            'Super !',
            'Bien joué !'
        ];
        feedbackEl.textContent = messages[Math.floor(Math.random() * messages.length)];
    } else {
        feedbackEl.textContent = `❌ Incorrect. La bonne réponse est: ${correctAnswer}`;
    }

    // Update session stats
    correctCountEl.textContent = state.currentSessionCorrect;
    incorrectCountEl.textContent = state.currentSessionIncorrect;
}

// Show completion message
function showCompletionMessage() {
    feedbackEl.className = 'feedback correct show';
    feedbackEl.textContent = 'Verbe complété ! Retour à la sélection...';

    setTimeout(() => {
        showSelectionView();
        updateStats();
    }, 2000);
}

// Save progress to localStorage
function saveProgress() {
    const progress = {
        practicedVerbs: Array.from(state.practicedVerbs),
        correctAnswers: state.correctAnswers,
        incorrectAnswers: state.incorrectAnswers
    };
    localStorage.setItem('verbsPracticeProgress', JSON.stringify(progress));
}

// Load progress from localStorage
function loadProgress() {
    const saved = localStorage.getItem('verbsPracticeProgress');
    if (saved) {
        try {
            const progress = JSON.parse(saved);
            state.practicedVerbs = new Set(progress.practicedVerbs || []);
            state.correctAnswers = progress.correctAnswers || 0;
            state.incorrectAnswers = progress.incorrectAnswers || 0;
            updateStats();
            renderVerbsGrid();
        } catch (e) {
            console.error('Error loading progress:', e);
        }
    }
}

// Start the app
init();
