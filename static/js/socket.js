/**
 * Socket.IO event handling for game communication
 */

let socket = null;
let roomId = null;
let playerName = null;
let isDrawer = false;
let gameState = null;
let drawingCanvas = null; // Will be set when DrawingCanvas is initialized

// Make variables globally accessible
window.gameSocket = () => socket;
window.gameRoomId = () => roomId;
window.gamePlayerName = () => playerName;
window.gameIsDrawer = () => isDrawer;

function initSocket() {
    if (!window.ROOM_ID || !window.PLAYER_NAME) {
        console.error('Room ID or Player Name not found');
        return;
    }
    
    roomId = window.ROOM_ID;
    playerName = window.PLAYER_NAME;
    
    socket = io();
    
    // Initialize drawing canvas (must be available globally)
    if (typeof DrawingCanvas !== 'undefined') {
        drawingCanvas = new DrawingCanvas('drawing-canvas', socket, roomId);
        window.drawingCanvas = drawingCanvas; // Make globally accessible
    }
    
    setupSocketListeners();
    
    // Join room
    socket.emit('join_room', {
        room_id: roomId,
        player_name: playerName
    });
}

function setupSocketListeners() {
    // Connection events
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('connected', (data) => {
        console.log('Socket connected:', data);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    // Player management
    socket.on('update_players', (data) => {
        updatePlayersList(data.players);
    });
    
    socket.on('player_left', (data) => {
        addChatMessage('System', `${data.player} left the room`);
    });
    
    // Game state events
    socket.on('game_state', (data) => {
        gameState = data;
        updateGameUI(data);
    });
    
    socket.on('game_started', (data) => {
        gameState = data;
        updateGameUI(data);
        addChatMessage('System', 'Game started!');
    });
    
    socket.on('turn_started', (data) => {
        gameState = data;
        isDrawer = (data.current_drawer === playerName);
        updateGameUI(data);
        
        if (isDrawer) {
            addChatMessage('System', 'Your turn to draw!');
        } else {
            addChatMessage('System', `${data.current_drawer} is drawing...`);
        }
        
        // Update drawer mode for canvas
        if (drawingCanvas) {
            drawingCanvas.setDrawerMode(isDrawer);
        }
    });
    
    socket.on('turn_ended', (data) => {
        showTurnEndedModal(data);
        addChatMessage('System', `Turn ended! The word was: ${data.word}`);
    });
    
    // Word events
    socket.on('your_word', (data) => {
        showWordDisplay(data.word);
    });
    
    socket.on('hint_revealed', (data) => {
        updateWordHint(data);
    });
    
    // Drawing events
    socket.on('draw_update', (data) => {
        if (drawingCanvas) {
            drawingCanvas.drawFromRemote(data);
        }
    });
    
    socket.on('canvas_cleared', () => {
        if (drawingCanvas) {
            drawingCanvas.clearFromRemote();
        }
    });
    
    // Guess events
    socket.on('correct_guess', (data) => {
        addChatMessage('System', 
            `${data.player} guessed correctly! (+${data.points} points)`);
        updateScores(data.scores);
    });
    
    socket.on('wrong_guess', (data) => {
        // Wrong guess feedback (can be shown to player)
        console.log('Wrong guess:', data.message);
    });
    
    // Chat events
    socket.on('new_message', (data) => {
        addChatMessage(data.player, data.message, data.timestamp);
    });
    
    // Error handling
    socket.on('error', (data) => {
        console.error('Socket error:', data.message);
        alert('Error: ' + data.message);
    });
}

function updateGameUI(state) {
    // Update round number
    const roundEl = document.getElementById('round-number');
    if (roundEl) {
        roundEl.textContent = state.round_number || '-';
    }
    
    // Update time remaining
    const timeEl = document.getElementById('time-remaining');
    if (timeEl && state.time_remaining !== undefined) {
        timeEl.textContent = state.time_remaining;
    }
    
    // Update word length hint
    const wordLengthEl = document.getElementById('word-length');
    if (wordLengthEl && state.word_length) {
        wordLengthEl.textContent = state.word_length;
    }
    
    // Update scores
    if (state.players) {
        updateScores(state.players);
    }
    
    // Start countdown timer if game is active
    if (state.game_started && state.time_remaining !== undefined) {
        startTimer(state.time_remaining);
    }
}

function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    if (!playersList) return;
    
    playersList.innerHTML = '';
    
    players.forEach(playerName => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'p-2 border-b flex items-center gap-2';
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = playerName;
        
        // Mark current drawer
        if (gameState && gameState.current_drawer === playerName) {
            nameSpan.classList.add('font-bold', 'text-blue-600');
            const drawerBadge = document.createElement('span');
            drawerBadge.textContent = '✏️';
            drawerBadge.className = 'text-sm';
            playerDiv.appendChild(drawerBadge);
        }
        
        playerDiv.appendChild(nameSpan);
        playersList.appendChild(playerDiv);
    });
}

function updateScores(scores) {
    const scoresList = document.getElementById('scores-list');
    if (!scoresList) return;
    
    scoresList.innerHTML = '';
    
    // Sort by score (descending)
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    
    sortedScores.forEach(([name, score], index) => {
        const scoreDiv = document.createElement('div');
        scoreDiv.className = `p-2 border-b flex justify-between items-center ${
            name === playerName ? 'bg-blue-50 font-semibold' : ''
        }`;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        
        const scoreSpan = document.createElement('span');
        scoreSpan.textContent = score;
        scoreSpan.className = 'font-bold text-green-600';
        
        // Add rank indicator
        if (index === 0) {
            nameSpan.innerHTML = '🥇 ' + nameSpan.textContent;
        } else if (index === 1) {
            nameSpan.innerHTML = '🥈 ' + nameSpan.textContent;
        } else if (index === 2) {
            nameSpan.innerHTML = '🥉 ' + nameSpan.textContent;
        }
        
        scoreDiv.appendChild(nameSpan);
        scoreDiv.appendChild(scoreSpan);
        scoresList.appendChild(scoreDiv);
    });
}

function showWordDisplay(word) {
    const wordDisplay = document.getElementById('word-display');
    const currentWord = document.getElementById('current-word');
    
    if (wordDisplay && currentWord) {
        wordDisplay.classList.remove('hidden');
        currentWord.textContent = word;
    }
}

function hideWordDisplay() {
    const wordDisplay = document.getElementById('word-display');
    if (wordDisplay) {
        wordDisplay.classList.add('hidden');
    }
}

function updateWordHint(hintData) {
    const hintText = document.getElementById('hint-text');
    if (!hintText) return;
    
    const existingText = hintText.textContent;
    let newText = existingText;
    
    if (hintData.position === 'first') {
        newText = `First letter: ${hintData.hint}`;
    } else if (hintData.position === 'last') {
        newText = `First letter: ${gameState?.hints_revealed[0] || ''} | Last letter: ${hintData.hint}`;
    }
    
    hintText.textContent = newText;
}

function addChatMessage(player, message, timestamp) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'p-2 bg-gray-50 rounded';
    
    const playerSpan = document.createElement('span');
    playerSpan.className = 'font-semibold text-blue-600';
    playerSpan.textContent = player + ': ';
    
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    
    messageDiv.appendChild(playerSpan);
    messageDiv.appendChild(messageSpan);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTurnEndedModal(data) {
    const modal = document.getElementById('turn-ended-modal');
    const resultsDiv = document.getElementById('turn-results');
    
    if (!modal || !resultsDiv) return;
    
    let html = `<p class="mb-2">The word was: <strong>${data.word}</strong></p>`;
    html += '<p class="mb-4 font-semibold">Scores:</p>';
    html += '<ul class="list-disc list-inside">';
    
    const sortedScores = Object.entries(data.scores || {}).sort((a, b) => b[1] - a[1]);
    sortedScores.forEach(([name, score]) => {
        html += `<li>${name}: ${score} points</li>`;
    });
    
    html += '</ul>';
    resultsDiv.innerHTML = html;
    
    modal.classList.remove('hidden');
}

function startTimer(initialTime) {
    let timeLeft = initialTime;
    
    const timerInterval = setInterval(() => {
        timeLeft--;
        const timeEl = document.getElementById('time-remaining');
        if (timeEl) {
            timeEl.textContent = timeLeft;
            
            // Change color when time is running out
            if (timeLeft <= 10) {
                timeEl.classList.add('text-red-600', 'font-bold');
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Request game state update
            if (socket && roomId) {
                socket.emit('get_game_state', { room_id: roomId });
            }
        }
    }, 1000);
}

// Initialize socket when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSocket);
    } else {
        initSocket();
    }
}

