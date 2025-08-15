const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const room = window.location.pathname.split('/').pop();
const playerName = urlParams.get('player') || 'Guest';
const playerList = document.getElementById('player-list');
const inviteBtn = document.getElementById('invite-btn');
const friendInput = document.getElementById('friend-name');

// Join room with real player name
socket.emit('join_room', { room: room, player_name: playerName });

// Listen for updates
socket.on('update_players', data => {
    playerList.innerHTML = '';
    data.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        playerList.appendChild(li);
    });
});

// Invite friend
inviteBtn.addEventListener('click', () => {
    const friendName = friendInput.value.trim();
    if (friendName) {
        socket.emit('invite_friend', { room: room, friend: friendName });
        friendInput.value = '';
        alert(`Invite sent to ${friendName}`);
    }
});
