from flask import Blueprint, render_template, request, redirect, url_for

landing_bp = Blueprint('landing', __name__, template_folder='../templates')

@landing_bp.route('/', methods=['GET', 'POST'])
def landing():
    if request.method == 'POST':
        action = request.form.get('action')
        room_name = request.form.get('room_name', '').strip()
        player_name = request.form.get('player_name', '').strip()

        if action in ['create', 'join'] and room_name and player_name:
            return redirect(url_for('landing.lobby', room=room_name, player=player_name))

    return render_template('landing.html')

@landing_bp.route('/lobby/<room>')
def lobby(room):
    player_name = request.args.get('player', 'Guest')
    return render_template('lobby.html', room=room, player_name=player_name)
