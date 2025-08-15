from flask import Blueprint, render_template, request, redirect, url_for, flash
import random

landing_bp = Blueprint('landing', __name__, template_folder='../templates')

# Track active rooms
active_rooms = set()

@landing_bp.route('/', methods=['GET', 'POST'])
def landing():
    if request.method == 'POST':
        action = request.form.get('action')
        player_name = request.form.get('player_name', '').strip()
        room_id_input = request.form.get('room_id', '').strip()

        # Create room → generate unique 6-digit numeric ID
        if action == 'create' and player_name:
            new_room_id = str(random.randint(100000, 999999))  # 6-digit number
            active_rooms.add(new_room_id)
            return redirect(url_for('landing.lobby', room_id=new_room_id, player=player_name))

        # Join existing room by numeric ID
        elif action == 'join' and player_name and room_id_input:
            if room_id_input in active_rooms:
                return redirect(url_for('landing.lobby', room_id=room_id_input, player=player_name))
            else:
                flash(f"Room ID {room_id_input} does not exist.", "error")
                return render_template('landing.html')

    return render_template('landing.html')

@landing_bp.route('/lobby/<room_id>')
def lobby(room_id):
    player_name = request.args.get('player', 'Guest')
    return render_template('lobby.html', room_id=room_id, player_name=player_name)
