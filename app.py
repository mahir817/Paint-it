from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit
from Landing_Page.landingpage import landing_bp
from server.game import game_manager

app = Flask(__name__)
app.secret_key = "supersecretkey"

# Register blueprint
app.register_blueprint(landing_bp)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

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
            emit('player_left', {'player': player_name}, room=room_id, include_self=False)
            emit('update_players', {'players': game_manager.get_room(room_id).get_player_list()}, room=room_id)
            break

@socketio.on('join_room')
def handle_join(data):
    """Handle player joining a room"""
    room_id = data.get('room_id')
    player_name = data.get('player_name', 'Guest')
    
    if not room_id:
        emit('error', {'message': 'Room ID required'})
        return
    
    # Try to add player
    success = game_manager.add_player(room_id, player_name, request.sid)
    
    if not success:
        emit('error', {'message': 'Player name already taken in this room'})
        return
    
    join_room(room_id)
    room = game_manager.get_room(room_id)
    
    # Send updated player list to all in room
    emit('update_players', {'players': room.get_player_list()}, room=room_id)
    
    # Send current game state to the new player
    game_state = game_manager.get_game_state(room_id)
    if game_state:
        emit('game_state', game_state)

@socketio.on('start_game')
def handle_start_game(data):
    """Handle game start request"""
    room_id = data.get('room_id')
    room = game_manager.get_room(room_id)
    
    if not room or len(room.players) < 2:
        emit('error', {'message': 'Need at least 2 players to start'})
        return
    
    success = game_manager.start_game(room_id)
    if success:
        room = game_manager.get_room(room_id)
        game_state = game_manager.get_game_state(room_id)
        
        # Send word to drawer
        drawer_socket = room.players[room.current_drawer].socket_id
        emit('your_word', {'word': room.current_word}, room=drawer_socket)
        
        # Send game state to all
        emit('game_started', game_state, room=room_id)

@socketio.on('start_turn')
def handle_start_turn(data):
    """Start a new turn"""
    room_id = data.get('room_id')
    category = data.get('category')
    
    success = game_manager.start_new_turn(room_id, category)
    if success:
        room = game_manager.get_room(room_id)
        game_state = game_manager.get_game_state(room_id)
        
        # Send word to drawer
        drawer_socket = room.players[room.current_drawer].socket_id
        emit('your_word', {'word': room.current_word}, room=drawer_socket)
        
        # Send turn started to all
        emit('turn_started', game_state, room=room_id)

@socketio.on('submit_guess')
def handle_guess(data):
    """Handle word guess submission"""
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    guess = data.get('guess', '')
    
    result = game_manager.check_guess(room_id, player_name, guess)
    
    if result.get('correct'):
        # Correct guess
        room = game_manager.get_room(room_id)
        emit('correct_guess', {
            'player': player_name,
            'word': result.get('word'),
            'points': result.get('points'),
            'scores': result.get('scores')
        }, room=room_id)
        
        # If turn should end, end it
        if result.get('end_turn'):
            turn_results = game_manager.end_turn(room_id)
            emit('turn_ended', turn_results, room=room_id)
            
            # Start next turn
            room = game_manager.get_room(room_id)
            drawer_socket = room.players[room.current_drawer].socket_id
            emit('your_word', {'word': room.current_word}, room=drawer_socket)
            emit('turn_started', game_manager.get_game_state(room_id), room=room_id)
    else:
        # Wrong guess or error
        if result.get('censored'):
            emit('error', {'message': 'Invalid guess - word detected'}, room=request.sid)
        else:
            emit('wrong_guess', {'message': result.get('error', 'Wrong guess!')}, room=request.sid)

@socketio.on('draw')
def handle_draw(data):
    """Handle drawing data from canvas"""
    room_id = data.get('room_id')
    
    # Broadcast drawing to all except sender
    emit('draw_update', {
        'x': data.get('x'),
        'y': data.get('y'),
        'prevX': data.get('prevX'),
        'prevY': data.get('prevY'),
        'color': data.get('color'),
        'lineWidth': data.get('lineWidth'),
        'isDrawing': data.get('isDrawing')
    }, room=room_id, include_self=False)

@socketio.on('clear_canvas')
def handle_clear_canvas(data):
    """Handle canvas clear"""
    room_id = data.get('room_id')
    emit('canvas_cleared', {}, room=room_id, include_self=False)

@socketio.on('send_message')
def handle_message(data):
    """Handle chat message"""
    room_id = data.get('room_id')
    player_name = data.get('player_name')
    message = data.get('message', '')
    
    # Censor word if it's in the message
    room = game_manager.get_room(room_id)
    if room and room.current_word:
        if game_manager._contains_word(message.upper(), room.current_word):
            emit('error', {'message': 'Message contains forbidden word'}, room=request.sid)
            return
    
    emit('new_message', {
        'player': player_name,
        'message': message,
        'timestamp': data.get('timestamp')
    }, room=room_id)

@socketio.on('request_hint')
def handle_hint_request(data):
    """Handle hint request"""
    room_id = data.get('room_id')
    hint_data = game_manager.reveal_hint(room_id)
    
    if hint_data:
        emit('hint_revealed', hint_data, room=room_id)

@socketio.on('get_game_state')
def handle_get_state(data):
    """Handle game state request"""
    room_id = data.get('room_id')
    game_state = game_manager.get_game_state(room_id)
    
    if game_state:
        emit('game_state', game_state)

if __name__ == "__main__":
    socketio.run(app, debug=True)
