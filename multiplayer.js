// Multiplayer Module for Irregular Verbs App
// Uses Socket.io for real-time communication

// Profile Management
const ProfileManager = {
    profile: null,

    init() {
        this.load();
        if (!this.profile) {
            showProfileOverlay();
        } else {
            updateProfileDisplay();
        }
    },

    load() {
        const saved = localStorage.getItem('irregulierProfile');
        if (saved) {
            try {
                this.profile = JSON.parse(saved);
            } catch (e) {
                console.error('Erreur chargement profil:', e);
            }
        }
    },

    save(username) {
        this.profile = {
            username: username.trim(),
            createdAt: Date.now()
        };
        localStorage.setItem('irregulierProfile', JSON.stringify(this.profile));
    },

    getUsername() {
        return this.profile?.username || 'Joueur';
    }
};

// Multiplayer Manager
const MultiplayerManager = {
    socket: null,
    isConnected: false,
    roomCode: null,
    isHost: false,
    players: [],
    gameStarted: false,
    myVerbs: [],
    currentVerbIndex: 0,
    gameConfig: null, // Store game configuration

    // Connect to server
    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.isConnected) {
                resolve();
                return;
            }

            // Toujours se connecter au serveur sur le port 3000
            const serverUrl = window.location.protocol + '//' + window.location.hostname + ':3000';

            this.socket = io(serverUrl, {
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                console.log('Connecté au serveur');
                this.isConnected = true;
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('Erreur de connexion:', error);
                this.isConnected = false;
                reject(error);
            });

            // Setup event listeners
            this.setupEventListeners();
        });
    },

    setupEventListeners() {
        // Room created
        this.socket.on('room-created', (data) => {
            this.roomCode = data.roomCode;
            this.isHost = true;
            this.players = data.players;
            showWaitingRoom(data.roomCode, data.players, true);
        });

        // Room joined
        this.socket.on('room-joined', (data) => {
            this.roomCode = data.roomCode;
            this.isHost = false;
            this.players = data.players;
            showWaitingRoom(data.roomCode, data.players, false);
        });

        // Join error
        this.socket.on('join-error', (data) => {
            alert(data.message);
        });

        // Player joined
        this.socket.on('player-joined', (data) => {
            this.players = data.players;
            updateWaitingRoomPlayers(data.players);
        });

        // Player left
        this.socket.on('player-left', (data) => {
            this.players = data.players;
            this.isHost = data.newHost === this.socket.id;
            updateWaitingRoomPlayers(data.players);
            if (this.isHost) {
                document.getElementById('start-multi-game').style.display = 'block';
            }
        });

        // Game started
        this.socket.on('game-started', (data) => {
            this.gameStarted = true;
            this.myVerbs = data.verbs;
            this.players = data.players;
            startMultiplayerGame(data);
        });

        // Progress update from other players
        this.socket.on('progress-update', (data) => {
            updatePlayerProgress(data.playerId, data.progress, data.username, data.color);
        });

        // Player finished
        this.socket.on('player-done', (data) => {
            showPlayerFinished(data.username, data.position);
        });

        // Game ended
        this.socket.on('game-ended', (data) => {
            this.gameStarted = false;
            showPodium(data.rankings);
        });
    },

    // Create a room
    async createRoom(config) {
        this.gameConfig = config; // Save config for start game
        await this.connect();
        this.socket.emit('create-room', {
            username: ProfileManager.getUsername(),
            verbCount: config.verbCount,
            timerEnabled: config.timerEnabled,
            timerDuration: config.timerDuration
        });
    },

    // Join a room
    async joinRoom(roomCode) {
        await this.connect();
        this.socket.emit('join-room', {
            roomCode: roomCode.toUpperCase(),
            username: ProfileManager.getUsername()
        });
    },

    // Start the game (host only)
    startGame() {
        if (!this.isHost) return;

        // Determine which verbs to send
        let verbsToSend = irregularVerbs;
        if (this.gameConfig && this.gameConfig.customVerbs) {
            verbsToSend = this.gameConfig.customVerbs;
        }

        this.socket.emit('start-game', {
            verbs: verbsToSend // Send configured verbs
        });
    },

    // Update progress
    updateProgress(progress, currentIndex) {
        if (this.socket && this.gameStarted) {
            this.socket.emit('update-progress', {
                progress,
                currentIndex
            });
        }
    },

    // Player finished
    playerFinished(score) {
        if (this.socket && this.gameStarted) {
            this.socket.emit('player-finished', { score });
        }
    },

    // Leave room
    leaveRoom() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.roomCode = null;
        this.isHost = false;
        this.players = [];
        this.gameStarted = false;
    }
};

// UI Functions
function showProfileOverlay() {
    const overlay = document.getElementById('profile-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

function hideProfileOverlay() {
    const overlay = document.getElementById('profile-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function updateProfileDisplay() {
    const usernameDisplay = document.getElementById('username-display');
    if (usernameDisplay && ProfileManager.profile) {
        usernameDisplay.textContent = ProfileManager.profile.username;
        usernameDisplay.parentElement.style.display = 'flex';
    }
}

function showMultiplayerOptions() {
    const overlay = document.getElementById('multiplayer-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

function hideMultiplayerOptions() {
    const overlay = document.getElementById('multiplayer-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function showWaitingRoom(roomCode, players, isHost) {
    hideMultiplayerOptions();
    const overlay = document.getElementById('waiting-room-overlay');
    if (overlay) {
        document.getElementById('room-code-display').textContent = roomCode;
        updateWaitingRoomPlayers(players);
        document.getElementById('start-multi-game').style.display = isHost ? 'block' : 'none';
        overlay.classList.add('active');
    }
}

function updateWaitingRoomPlayers(players) {
    const container = document.getElementById('waiting-players-list');
    if (container) {
        container.innerHTML = players.map(p => `
            <div class="waiting-player" style="border-left: 4px solid ${p.color}">
                <span class="player-name">${p.username}</span>
                ${p.id === MultiplayerManager.socket?.id ? '<span class="you-badge">Vous</span>' : ''}
                ${p.id === players[0]?.id ? '<span class="host-badge">Hôte</span>' : ''}
            </div>
        `).join('');
    }
}

function startMultiplayerGame(data) {
    // Hide waiting room
    const waitingOverlay = document.getElementById('waiting-room-overlay');
    if (waitingOverlay) {
        waitingOverlay.classList.remove('active');
    }

    // Setup multiplayer progress bars
    const progressContainer = document.getElementById('multiplayer-progress');
    if (progressContainer) {
        progressContainer.innerHTML = data.players.map(p => `
            <div class="player-progress-bar" data-player-id="${p.id}">
                <div class="player-progress-info">
                    <span class="player-progress-name" style="color: ${p.color}">${p.username}</span>
                    <span class="player-progress-percent">0%</span>
                </div>
                <div class="player-progress-track">
                    <div class="player-progress-fill" style="background-color: ${p.color}; width: 0%"></div>
                </div>
            </div>
        `).join('');
        progressContainer.classList.remove('hidden');
    }

    // Start the game with assigned verbs
    state.trainingMode = true;
    state.multiplayerMode = true;
    state.trainingQueue = [...data.verbs];
    state.trainingConfig.verbCount = data.verbs.length;
    state.trainingConfig.timerEnabled = data.timerEnabled;
    state.trainingConfig.timerDuration = data.timerDuration;
    state.missedVerbs = [];
    state.currentSessionCorrect = 0;
    state.currentSessionIncorrect = 0;

    startNextTrainingVerb();
}

function updatePlayerProgress(playerId, progress, username, color) {
    const bar = document.querySelector(`.player-progress-bar[data-player-id="${playerId}"]`);
    if (bar) {
        const fill = bar.querySelector('.player-progress-fill');
        const percent = bar.querySelector('.player-progress-percent');
        if (fill) fill.style.width = `${progress}%`;
        if (percent) percent.textContent = `${Math.round(progress)}%`;
    }
}

function showPlayerFinished(username, position) {
    const notification = document.createElement('div');
    notification.className = 'finish-notification';
    notification.innerHTML = `${username} a terminé en position ${position}!`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showPodium(rankings) {
    const overlay = document.getElementById('podium-overlay');
    if (!overlay) return;

    const podiumContainer = document.getElementById('podium-container');

    // Generate podium HTML
    let podiumHTML = '<div class="podium-visual">';

    // Position 2 (left, medium height)
    if (rankings[1]) {
        podiumHTML += `
            <div class="podium-place podium-2" style="--podium-color: ${rankings[1].color}">
                <div class="podium-player">${rankings[1].username}</div>
                <div class="podium-block">
                    <span class="podium-position">2</span>
                </div>
            </div>
        `;
    }

    // Position 1 (center, tallest)
    if (rankings[0]) {
        podiumHTML += `
            <div class="podium-place podium-1" style="--podium-color: ${rankings[0].color}">
                <div class="podium-player">${rankings[0].username}</div>
                <div class="podium-block">
                    <span class="podium-position">1</span>
                </div>
            </div>
        `;
    }

    // Position 3 (right, shortest)
    if (rankings[2]) {
        podiumHTML += `
            <div class="podium-place podium-3" style="--podium-color: ${rankings[2].color}">
                <div class="podium-player">${rankings[2].username}</div>
                <div class="podium-block">
                    <span class="podium-position">3</span>
                </div>
            </div>
        `;
    }

    podiumHTML += '</div>';

    // Other positions
    if (rankings.length > 3) {
        podiumHTML += '<div class="other-rankings">';
        for (let i = 3; i < rankings.length; i++) {
            const time = (rankings[i].time / 1000).toFixed(1);
            podiumHTML += `
                <div class="other-rank" style="border-left: 4px solid ${rankings[i].color}">
                    <span class="rank-position">${i + 1}.</span>
                    <span class="rank-name">${rankings[i].username}</span>
                    <span class="rank-time">${time}s</span>
                </div>
            `;
        }
        podiumHTML += '</div>';
    }

    podiumContainer.innerHTML = podiumHTML;
    overlay.classList.add('active');

    // Hide multiplayer progress
    const progressContainer = document.getElementById('multiplayer-progress');
    if (progressContainer) {
        progressContainer.classList.add('hidden');
    }
}

function hidePodium() {
    const overlay = document.getElementById('podium-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    state.multiplayerMode = false;
    MultiplayerManager.leaveRoom();
    showSelectionView();
}

// Initialize profile when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    ProfileManager.init();
});
