/**
 * UI interactions and animations
 */

function initUI() {
    setupChatInput();
    setupHintButton();
    setupModal();
    setupKeyboardShortcuts();
}

function setupChatInput() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    if (!chatInput || !sendBtn) return;
    
    function sendMessage() {
        const message = chatInput.value.trim();
        if (!message || !socket || !roomId || !playerName) return;
        
        // Don't allow drawer to send guesses
        if (isDrawer) {
            addChatMessage('System', 'You are drawing, cannot guess!');
            chatInput.value = '';
            return;
        }
        
        // Send as guess
        socket.emit('submit_guess', {
            room_id: roomId,
            player_name: playerName,
            guess: message
        });
        
        // Also send as chat message
        socket.emit('send_message', {
            room_id: roomId,
            player_name: playerName,
            message: message,
            timestamp: new Date().toISOString()
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
    
    if (!hintBtn || !socket || !roomId) return;
    
    hintBtn.addEventListener('click', () => {
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
    const modal = document.getElementById('turn-ended-modal');
    const closeBtn = document.getElementById('close-modal');
    
    if (!modal || !closeBtn) return;
    
    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
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
        
        // Escape to close modal
        if (e.key === 'Escape') {
            const modal = document.getElementById('turn-ended-modal');
            if (modal && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        }
        
        // C to clear canvas (only for drawer)
        if (e.key === 'c' || e.key === 'C') {
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

