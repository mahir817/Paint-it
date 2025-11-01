from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit
from Landing_Page.landingpage import landing_bp
from server.game import game_manager
from server.models import GameStateEnum
import time

app = Flask(__name__)
app.secret_key = "supersecretkey"

# Register blueprint
app.register_blueprint(landing_bp)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Set socketio instance in game manager
game_manager.set_socketio(socketio)

# Route for game room
@app.route('/room/<room_id>')
def room(room_id):
    player_name = request.args.get('player', 'Guest')
    return render_template('room.html', room_id=room_id, player_name=player_name)

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    emit('connected', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    # Find and remove player from all rooms
    from flask import request as flask_request
    socket_id = flask_request.sid
    
    # Search all rooms for this socket
    for room_id in list(game_manager.rooms.keys()):
        player_name = game_manager.remove_player(room_id, socket_id)
        if player_name:
            leave_room(room_id)
            room = game_manager.get_room(room_id)
            if room:  # Room still exists
                emit('player_left', {'player': player_name}, room=room_id, include_self=False)
                players_data = [p.to_dict() for p in room.players.values()]
                emit('update_player_list', {'players': players_data}, room=room_id)
            break

@socketio.on('join_room')
def handle_join(data):
    """Handle player joining a room"""
    room_id = data.get('room_id') or data.get('roomCode')
    player_name = data.get('player_name') or data.get('username', 'Guest')
    
    if not room_id:
        emit('error', {'message': 'Room ID required'})
        return
    
    # Try to add player
    success, is_host = game_manager.add_player(room_id, player_name, request.sid)
    
    if not success:
        emit('error', {'message': 'Player name already taken in this room'})
        return

    join_room(room_id)
    room = game_manager.get_room(room_id)
    
    # Send updated player list to all in room
    players_data = [p.to_dict() for p in room.players.values()]
    emit('update_player_list', {'players': players_data}, room=room_id)
    
    # Send current game state to the new player
    game_state = game_manager.get_game_state(room_id)
    if game_state:
        emit('game_state', game_state, room=request.sid)
    
    # Notify if player is host
    if is_host:
        emit('you_are_host', {}, room=request.sid)

@socketio.on('start_game')
def handle_start_game(data):
    """Handle game start request (only host can start)"""
    room_id = data.get('room_id') or data.get('roomCode')
    room = game_manager.get_room(room_id)
    
    if not room:
        emit('error', {'message': 'Room not found'})
        return
    
    # Check if requester is host
    player = room.get_player_by_socket(request.sid)
    if not player or not player.is_host:
        emit('error', {'message': 'Only host can start the game'})
        return
    
    if len(room.players) < 2:
        emit('error', {'message': 'Need at least 2 players to start'})
        return
    
    category = data.get('category')
    max_rounds = data.get('max_rounds', 5)
    room.max_rounds = max_rounds
    
    success = game_manager.start_game(room_id)
    if success:
        game_state = game_manager.get_game_state(room_id)
        emit('game_started', game_state, room=room_id)

@socketio.on('drawing')
def handle_drawing(data):
    """Handle drawing strokes from canvas"""
    room_id = data.get('room_id') or data.get('room')
    
    if not room_id:
        return
    
    # Broadcast to all except sender
    emit('update_canvas', {
        'x0': data.get('x0') or data.get('prevX'),
        'y0': data.get('y0') or data.get('prevY'),
        'x1': data.get('x1') or data.get('x'),
        'y1': data.get('y1') or data.get('y'),
        'color': data.get('color'),
        'size': data.get('size') or data.get('lineWidth')
    }, room=room_id, include_self=False)

@socketio.on('guess')
def handle_guess(data):
    """Handle word guess submission"""
    room_id = data.get('room_id') or data.get('roomCode')
    guess = data.get('guess', '').strip()
    
    if not room_id or not guess:
        return
    
    room = game_manager.get_room(room_id)
    if not room:
        emit('error', {'message': 'Room not found'}, room=request.sid)
        return
    
    # Find player by socket ID
    player = room.get_player_by_socket(request.sid)
    if not player:
        emit('error', {'message': 'Player not found'}, room=request.sid)
        return
    
    result = game_manager.check_guess(room_id, player.name, guess)
    
    if result.get('correct'):
        # Correct guess
        emit('correct_guess', {
            'player': player.name,
            'word': result.get('word'),
            'points': result.get('points'),
            'drawer_bonus': result.get('drawer_bonus', 0),
            'scores': result.get('scores')
        }, room=room_id)
        
        # If round should end, end it
        if result.get('end_round'):
            # end_round will handle emitting round_end
            pass
    else:
        # Wrong guess or error
        error_msg = result.get('error', 'Wrong guess!')
        
        if result.get('censored'):
            emit('blocked_message', {'message': 'Invalid guess - word detected'}, room=request.sid)
        else:
            # Show wrong guess as regular chat message
            emit('new_message', {
                'player': player.name,
                'message': guess
            }, room=room_id)


@socketio.on('clear_canvas')
def handle_clear_canvas(data):
    """Handle canvas clear"""
    room_id = data.get('room_id')
    emit('canvas_cleared', {}, room=room_id, include_self=False)

@socketio.on('send_message')
def handle_message(data):
    """Handle chat message (non-guess)"""
    room_id = data.get('room_id') or data.get('roomCode')
    message = data.get('message', '').strip()
    
    if not room_id or not message:
        return
    
    room = game_manager.get_room(room_id)
    if not room:
        return
    
    player = room.get_player_by_socket(request.sid)
    if not player:
        return
    
    # Censor word if it's too similar (anti-cheating)
    if room.current_word:
        if game_manager.is_similar_word(room.current_word, message):
            emit('blocked_message', {'message': 'Message blocked - word detected'}, room=request.sid)
            return
    
    emit('new_message', {
        'player': player.name,
        'message': message,
        'timestamp': data.get('timestamp')
    }, room=room_id)

@socketio.on('get_game_state')
def handle_get_state(data):
    """Handle game state request"""
    room_id = data.get('room_id') or data.get('roomCode')
    
    game_state = game_manager.get_game_state(room_id)
    if game_state:
        emit('game_state', game_state, room=request.sid)

if __name__ == "__main__":
    socketio.run(app, debug=True)
