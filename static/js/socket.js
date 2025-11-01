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
        console.error('Room ID or Player Name not found', {
            ROOM_ID: window.ROOM_ID,
            PLAYER_NAME: window.PLAYER_NAME
        });
        // Retry after a short delay
        setTimeout(initSocket, 100);
        return;
    }
    
    roomId = window.ROOM_ID;
    playerName = window.PLAYER_NAME;
    
    console.log('Initializing socket for room:', roomId, 'player:', playerName);
    socket = io();
    
    // Update global getters
    window.gameSocket = () => socket;
    window.gameRoomId = () => roomId;
    window.gamePlayerName = () => playerName;
    
    setupSocketListeners();
    
    // Wait for DOM and socket to be ready before initializing canvas
    const initCanvas = () => {
        if (typeof DrawingCanvas !== 'undefined' && document.getElementById('drawing-canvas')) {
            drawingCanvas = new DrawingCanvas('drawing-canvas', socket, roomId);
            window.drawingCanvas = drawingCanvas; // Make globally accessible
            // Initially enable drawing (will be disabled later if not drawer)
            drawingCanvas.setDrawerMode(true);
        }
    };
    
    // Initialize canvas when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCanvas);
    } else {
        // Small delay to ensure socket is connected
        setTimeout(initCanvas, 100);
    }
    
    // Function to join room
    const joinRoom = () => {
        console.log('Joining room:', roomId, 'as', playerName);
        socket.emit('join_room', {
            room_id: roomId,
            player_name: playerName
        });
    };
    
    // Wait for connection before joining room
    socket.once('connect', () => {
        console.log('Socket connected, joining room...');
        joinRoom();
    });
    
    // Also try to join immediately if already connected
    if (socket.connected) {
        joinRoom();
    }
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
    socket.on('update_player_list', (data) => {
        console.log('Players updated:', data.players);
        if (data.players && Array.isArray(data.players)) {
            updatePlayersList(data.players);
            // Update scores from player data
            const scores = {};
            data.players.forEach(p => {
                scores[p.name] = p.score || 0;
            });
            updateScores(scores);
        }
    });
    
    // Backward compatibility
    socket.on('update_players', (data) => {
        if (data.players && Array.isArray(data.players)) {
            updatePlayersList(data.players);
        }
    });
    
    socket.on('you_are_host', () => {
        console.log('You are the host!');
        addChatMessage('System', 'You are the host - you can start the game!');
        // Show host controls (can be added to UI)
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
    
    socket.on('round_start', (data) => {
        console.log('Round started:', data);
        gameState = gameState || {};
        gameState.current_drawer = data.drawer;
        gameState.current_round = data.round;
        gameState.max_rounds = data.max_rounds;
        
        isDrawer = (data.drawer === playerName);
        window.gameIsDrawer = () => isDrawer;
        
        updateGameUI(gameState);
        
        if (isDrawer) {
            addChatMessage('System', 'Your turn to draw!');
        } else {
            addChatMessage('System', `${data.drawer} is drawing...`);
            // Show word blanks
            showWordBlanks(data.word_length);
        }
        
        // Update drawer mode for canvas
        if (drawingCanvas) {
            drawingCanvas.setDrawerMode(isDrawer);
        }
    });
    
    socket.on('timer_update', (data) => {
        const timeEl = document.getElementById('time-remaining');
        if (timeEl) {
            timeEl.textContent = data.time_left;
            
            // Change color when time is running out
            if (data.time_left <= 10) {
                timeEl.classList.add('text-red-600', 'font-bold');
            } else {
                timeEl.classList.remove('text-red-600', 'font-bold');
            }
        }
    });
    
    socket.on('round_end', (data) => {
        showRoundEndModal(data);
        addChatMessage('System', `Round ${data.round} ended! The word was: ${data.word}`);
    });
    
    socket.on('game_over', (data) => {
        showGameOverModal(data);
        addChatMessage('System', `🎉 Game Over! Winner: ${data.winner} with ${data.winner_score} points!`);
    });
    
    // Word events
    socket.on('your_word', (data) => {
        showWordDisplay(data.word);
    });
    
    socket.on('hint', (data) => {
        console.log('Hint received:', data);
        updateWordHint(data);
    });
    
    socket.on('blocked_message', (data) => {
        addChatMessage('System', data.message || 'Message blocked');
    });
    
    // Drawing events
    socket.on('update_canvas', (data) => {
        if (drawingCanvas) {
            drawingCanvas.drawFromRemote({
                prevX: data.x0,
                prevY: data.y0,
                x: data.x1,
                y: data.y1,
                color: data.color,
                lineWidth: data.size,
                isDrawing: true
            });
        }
    });
    
    // Backward compatibility
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
            `🎉 ${data.player} guessed correctly! (+${data.points} points)`);
        if (data.drawer_bonus > 0) {
            addChatMessage('System', 
                `Drawer bonus: +${data.drawer_bonus} points`);
        }
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
    
    // Update scores - convert player state to scores dict
    if (state.players) {
        const scores = {};
        for (const [name, playerData] of Object.entries(state.players)) {
            scores[name] = playerData.score || 0;
        }
        updateScores(scores);
    }
    
    // Start countdown timer if game is active
    if (state.game_started && state.time_remaining !== undefined) {
        startTimer(state.time_remaining);
    }
}

function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    if (!playersList) {
        console.error('players-list element not found');
        return;
    }
    
    console.log('Updating players list with:', players);
    playersList.innerHTML = '';
    
    if (!players || players.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'p-2 text-gray-500 text-sm';
        emptyDiv.textContent = 'No players yet';
        playersList.appendChild(emptyDiv);
        return;
    }
    
    // Handle both array of strings and array of objects
    players.forEach(playerData => {
        const playerName = typeof playerData === 'string' ? playerData : playerData.name;
        const playerObj = typeof playerData === 'object' ? playerData : null;
        
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
        
        // Mark host
        if (playerObj && playerObj.is_host) {
            const hostBadge = document.createElement('span');
            hostBadge.textContent = '👑';
            hostBadge.className = 'text-sm';
            hostBadge.title = 'Host';
            playerDiv.appendChild(hostBadge);
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

function showWordBlanks(length) {
    const hintText = document.getElementById('word-hint');
    const hintDisplay = document.getElementById('hint-display');
    
    if (hintDisplay) {
        hintDisplay.textContent = '_ '.repeat(length).trim();
        hintDisplay.className = 'text-2xl font-mono text-center';
    }
    
    if (hintText) {
        hintText.textContent = `Word length: ${length}`;
    }
}

function updateWordHint(hintData) {
    const hintDisplay = document.getElementById('hint-display');
    const hintText = document.getElementById('word-hint');
    
    if (!hintDisplay) return;
    
    if (hintData.word_display) {
        hintDisplay.textContent = hintData.word_display;
        hintDisplay.className = 'text-2xl font-mono text-center';
    } else if (hintData.type === 'first_letter') {
        hintDisplay.textContent = `${hintData.letter}${'_ '.repeat(gameState?.word_length - 1 || 0).trim()}`;
        addChatMessage('System', `💡 Hint: First letter is "${hintData.letter}"`);
    } else if (hintData.type === 'last_letter') {
        const currentDisplay = hintDisplay.textContent || '';
        const wordLength = gameState?.word_length || 0;
        const firstLetter = currentDisplay[0] || '_';
        hintDisplay.textContent = `${firstLetter}${'_ '.repeat(wordLength - 2).trim()} ${hintData.letter}`;
        addChatMessage('System', `💡 Hint: Last letter is "${hintData.letter}"`);
    } else if (hintData.type === 'pattern' || hintData.pattern) {
        hintDisplay.textContent = hintData.pattern || hintData.word_display;
        addChatMessage('System', `💡 Hint: ${hintData.pattern || hintData.word_display}`);
    }
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

// Make addChatMessage globally accessible
window.addChatMessage = addChatMessage;

function showRoundEndModal(data) {
    const modal = document.getElementById('round-ended-modal');
    const resultsDiv = document.getElementById('round-results');
    const roundSpan = document.getElementById('modal-round');
    
    if (!modal || !resultsDiv) return;
    
    if (roundSpan) {
        roundSpan.textContent = data.round || '-';
    }
    
    let html = `<p class="mb-2 text-lg">The word was: <strong class="text-2xl">${data.word}</strong></p>`;
    html += '<p class="mb-4 font-semibold">Current Scores:</p>';
    html += '<ul class="list-disc list-inside space-y-1">';
    
    const sortedScores = Object.entries(data.scores || {}).sort((a, b) => b[1] - a[1]);
    sortedScores.forEach(([name, score], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        html += `<li class="${index === 0 ? 'font-bold text-yellow-600' : ''}">${medal} ${name}: ${score} points</li>`;
    });
    
    html += '</ul>';
    resultsDiv.innerHTML = html;
    
    modal.classList.remove('hidden');
}

function showGameOverModal(data) {
    const modal = document.getElementById('game-over-modal');
    const resultsDiv = document.getElementById('game-over-results');
    
    if (!modal || !resultsDiv) return;
    
    let html = `<p class="mb-4 text-xl">🎉 Winner: <strong class="text-2xl text-yellow-600">${data.winner}</strong> with ${data.winner_score} points!</p>`;
    html += '<p class="mb-4 font-semibold">Final Scores:</p>';
    html += '<ul class="list-disc list-inside space-y-1">';
    
    (data.final_scores || []).forEach(([name, score], index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        html += `<li class="${index === 0 ? 'font-bold text-yellow-600 text-lg' : ''}">${medal} ${name}: ${score} points</li>`;
    });
    
    html += '</ul>';
    resultsDiv.innerHTML = html;
    
    modal.classList.remove('hidden');
}

let currentTimer = null;

function startTimer(initialTime) {
    // Clear existing timer if any
    if (currentTimer) {
        clearInterval(currentTimer);
    }
    
    let timeLeft = initialTime;
    
    const timerInterval = setInterval(() => {
        timeLeft--;
        const timeEl = document.getElementById('time-remaining');
        if (timeEl) {
            timeEl.textContent = timeLeft;
            
            // Change color when time is running out
            if (timeLeft <= 10) {
                timeEl.classList.add('text-red-600', 'font-bold');
            } else {
                timeEl.classList.remove('text-red-600', 'font-bold');
            }
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            currentTimer = null;
            // Request game state update (server should handle turn timeout)
            if (socket && roomId) {
                socket.emit('get_game_state', { room_id: roomId });
            }
        }
    }, 1000);
    
    currentTimer = timerInterval;
}

// Initialize socket when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            // Small delay to ensure all scripts are loaded
            setTimeout(initSocket, 50);
        });
    } else {
        // Small delay to ensure all scripts are loaded
        setTimeout(initSocket, 50);
    }
}


