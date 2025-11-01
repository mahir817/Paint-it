/**
 * UI interactions and animations
 */

function initUI() {
    // Wait a bit for socket to initialize
    const checkSocket = () => {
        const socket = window.gameSocket ? window.gameSocket() : null;
        if (!socket) {
            // Retry after a short delay
            setTimeout(checkSocket, 100);
            return;
        }
        
        setupChatInput();
        setupHintButton();
        setupModal();
        setupKeyboardShortcuts();
    };
    
    checkSocket();
}

function setupChatInput() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (!chatInput || !sendBtn) return;
    
    function sendMessage() {
        const message = chatInput.value.trim();
        const socket = window.gameSocket ? window.gameSocket() : null;
        const roomId = window.gameRoomId ? window.gameRoomId() : null;
        const playerName = window.gamePlayerName ? window.gamePlayerName() : null;
        const isDrawer = window.gameIsDrawer ? window.gameIsDrawer() : false;
        
        if (!message || !socket || !roomId || !playerName) {
            console.log('Cannot send message:', {socket: !!socket, roomId, playerName, message});
            return;
        }
        
        // Don't allow drawer to send guesses (but allow chat)
        if (isDrawer) {
            // Allow drawer to send chat messages but not guesses
            socket.emit('send_message', {
                room_id: roomId,
                player_name: playerName,
                message: message,
                timestamp: new Date().toISOString()
            });
            chatInput.value = '';
            return;
        }
        
        // Send as guess
        socket.emit('guess', {
            roomCode: roomId,
            guess: message
        });
        
        chatInput.value = '';
    }
    
    sendBtn.addEventListener('click', sendMessage);
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function setupHintButton() {
    const hintBtn = document.getElementById('hint-btn');
    
    if (!hintBtn) return;
    
    hintBtn.addEventListener('click', () => {
        const socket = window.gameSocket ? window.gameSocket() : null;
        const roomId = window.gameRoomId ? window.gameRoomId() : null;
        const isDrawer = window.gameIsDrawer ? window.gameIsDrawer() : false;
        
        if (!socket || !roomId) return;
        
        // Only non-drawers can request hints
        if (isDrawer) {
            alert('You are the drawer! You know the word.');
            return;
        }
        
        socket.emit('request_hint', {
            room_id: roomId
        });
    });
}

function setupModal() {
    // Round end modal
    const roundModal = document.getElementById('round-ended-modal');
    const closeRoundBtn = document.getElementById('close-round-modal');
    
    if (roundModal && closeRoundBtn) {
        closeRoundBtn.addEventListener('click', () => {
            roundModal.classList.add('hidden');
        });
        
        roundModal.addEventListener('click', (e) => {
            if (e.target === roundModal) {
                roundModal.classList.add('hidden');
            }
        });
    }
    
    // Game over modal
    const gameModal = document.getElementById('game-over-modal');
    const closeGameBtn = document.getElementById('close-game-modal');
    
    if (gameModal && closeGameBtn) {
        closeGameBtn.addEventListener('click', () => {
            gameModal.classList.add('hidden');
        });
        
        gameModal.addEventListener('click', (e) => {
            if (e.target === gameModal) {
                gameModal.classList.add('hidden');
            }
        });
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to focus chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.focus();
            }
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            const roundModal = document.getElementById('round-ended-modal');
            const gameModal = document.getElementById('game-over-modal');
            if (roundModal && !roundModal.classList.contains('hidden')) {
                roundModal.classList.add('hidden');
            }
            if (gameModal && !gameModal.classList.contains('hidden')) {
                gameModal.classList.add('hidden');
            }
        }
        
        // C to clear canvas (only for drawer)
        if (e.key === 'c' || e.key === 'C') {
            const isDrawer = window.gameIsDrawer ? window.gameIsDrawer() : false;
            const drawingCanvas = window.drawingCanvas;
            if (isDrawer && drawingCanvas) {
                const clearBtn = document.getElementById('clear-btn');
                if (clearBtn && !clearBtn.disabled) {
                    drawingCanvas.clearCanvas();
                }
            }
        }
    });
}

// Add smooth animations
function animateScoreUpdate(element) {
    if (!element) return;
    
    element.style.transition = 'transform 0.3s ease';
    element.style.transform = 'scale(1.2)';
    
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 300);
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'error' ? 'bg-red-500' :
        type === 'success' ? 'bg-green-500' :
        'bg-blue-500'
    } text-white`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Initialize UI when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.showNotification = showNotification;
    window.animateScoreUpdate = animateScoreUpdate;
}

