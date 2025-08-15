from flask import Flask
from flask_socketio import SocketIO, join_room, emit
from Landing_Page.landingpage import landing_bp

app = Flask(__name__)
app.secret_key = "supersecretkey"

# Register blueprint
app.register_blueprint(landing_bp)

socketio = SocketIO(app, cors_allowed_origins="*")

# Track connected players per room ID
rooms_players = {}

@socketio.on('join_room')
def handle_join(data):
    room_id = data['room_id']
    player_name = data['player_name']

    if room_id not in rooms_players:
        rooms_players[room_id] = []

    if player_name not in rooms_players[room_id]:
        rooms_players[room_id].append(player_name)

    join_room(room_id)
    emit('update_players', {'players': rooms_players[room_id]}, room=room_id)

if __name__ == "__main__":
    socketio.run(app, debug=True)
