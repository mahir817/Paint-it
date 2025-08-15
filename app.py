from flask import Flask, request
from flask_socketio import SocketIO, join_room, emit
from Landing_Page.landingpage import landing_bp

app = Flask(__name__)
app.secret_key = "supersecretkey"

# Register blueprint
app.register_blueprint(landing_bp)

# Initialize Socket.IO
socketio = SocketIO(app, cors_allowed_origins="*")  # allow CORS for testing

# Dictionary to store players in rooms
rooms_players = {}

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
    emit('update_players', {'players': rooms_players[room]}, room=room)

@socketio.on('invite_friend')
def handle_invite(data):
    room = data['room']
    friend = data['friend']
    print(f"Invite {friend} to room {room}")  # For now, just log it

# ----------------- Run App -----------------

if __name__ == "__main__":
    socketio.run(app, debug=True)
