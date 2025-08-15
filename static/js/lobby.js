const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const room = window.location.pathname.split('/').pop();
const playerName = urlParams.get('player') || 'Guest';
const playerList = document.getElementById('player-list');
const inviteBtn = document.getElementById('invite-btn');
const friendInput = document.getElementById('friend-name');
const inviteList = document.getElementById('invite-list');

// Join room with player name
socket.emit('join_room', { room: room, player_name: playerName });

// Update connected players
socket.on('update_players', data => {
    playerList.innerHTML = '';
    data.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        playerList.appendChild(li);
    });
});

// Update invited friends
socket.on('update_invites', data => {
    inviteList.innerHTML = '';
    data.invites.forEach(friend => {
        const li = document.createElement('li');
        li.textContent = friend;
        inviteList.appendChild(li);
    });

    if (data.link) {
        const linkLi = document.createElement('li');
        const a = document.createElement('a');
        a.href = data.link;
        a.textContent = "Invite Link: " + data.link;
        a.target = "_blank";
        linkLi.appendChild(a);
        inviteList.appendChild(linkLi);
    }
});

// Invite friend button
inviteBtn.addEventListener('click', () => {
    const friendName = friendInput.value.trim();
    if (friendName) {
        socket.emit('invite_friend', { room: room, friend: friendName });
        friendInput.value = '';
    }
});
