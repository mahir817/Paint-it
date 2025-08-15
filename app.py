from flask import Flask
from flask_socketio import SocketIO, join_room, emit
from Landing_Page.landingpage import landing_bp

app = Flask(__name__)
app.secret_key = "supersecretkey"

# Register blueprint
app.register_blueprint(landing_bp)

# Initialize Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*")

# Dictionary to store players in rooms
rooms_players = {}
# Dictionary to store invited friends in rooms
rooms_invites = {}

# ----------------- Socket.IO Events -----------------

@socketio.on('join_room')
def handle_join(data):
    room = data['room']
    player_name = data['player_name']

    if room not in rooms_players:
        rooms_players[room] = []

    if player_name not in rooms_players[room]:
        rooms_players[room].append(player_name)

    join_room(room)

    # Send updated player list
    emit('update_players', {'players': rooms_players[room]}, room=room)

    # Send current invites
    invites = rooms_invites.get(room, [])
    emit('update_invites', {'invites': invites}, room=room)


@socketio.on('invite_friend')
def handle_invite(data):
    room = data['room']
    friend_name = data['friend']

    if room not in rooms_invites:
        rooms_invites[room] = []

    if friend_name not in rooms_invites[room]:
        rooms_invites[room].append(friend_name)

    # Generate invite link
    invite_link = f"/lobby/{room}?player={friend_name}"

    # Send updated invites to everyone in the room
    emit('update_invites', {'invites': rooms_invites[room], 'link': invite_link}, room=room)


if __name__ == "__main__":
    socketio.run(app, debug=True)
