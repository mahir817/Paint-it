from flask import Blueprint, render_template, request, redirect, url_for

landing_bp = Blueprint('landing', __name__, template_folder='../templates')

@landing_bp.route('/', methods=['GET', 'POST'])
def landing():
    if request.method == 'POST':
        action = request.form.get('action')
        room_name = request.form.get('room_name', '').strip()
        if action == 'create' and room_name:
            # Redirect to lobby with room name
            return redirect(url_for('landing.lobby', room=room_name))
        elif action == 'join' and room_name:
            return redirect(url_for('landing.lobby', room=room_name))
    return render_template('landing.html')

@landing_bp.route('/lobby/<room>')
def lobby(room):
    return f"Welcome to Lobby: {room} (Phase 1 placeholder)"
