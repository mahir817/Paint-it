"""Game state management: rooms, turns, scoring"""

from typing import Dict, Optional, Tuple, Callable
import random
import time
import threading
from difflib import SequenceMatcher
from server.models import GameState, Player, GameStateEnum
from server.words import get_random_word

class GameManager:
    """Manages all game rooms and their states"""
    
    def __init__(self):
        self.rooms: Dict[str, GameState] = {}
        self.socketio = None  # Will be set from app.py
    
    def set_socketio(self, socketio):
        """Set the socketio instance for emitting events"""
        self.socketio = socketio
    
    def create_or_get_room(self, room_id: str) -> GameState:
        """Create a new room or return existing one"""
        if room_id not in self.rooms:
            self.rooms[room_id] = GameState(room_id=room_id)
        return self.rooms[room_id]
    
    def get_room(self, room_id: str) -> Optional[GameState]:
        """Get room by ID"""
        return self.rooms.get(room_id)
    
    def add_player(self, room_id: str, player_name: str, socket_id: str) -> Tuple[bool, bool]:
        """Add a player to a room. Returns (success, is_host)"""
        room = self.create_or_get_room(room_id)
        
        # Check if name is already taken in this room
        if player_name in room.players:
            # If same socket, allow reconnection
            if room.players[player_name].socket_id == socket_id:
                room.players[player_name].socket_id = socket_id  # Update socket
                return True, room.players[player_name].is_host
            return False, False
        
        # First player becomes host
        is_first_player = len(room.players) == 0
        is_host = is_first_player
        
        room.players[player_name] = Player(
            name=player_name, 
            socket_id=socket_id,
            is_host=is_host
        )
        return True, is_host
    
    def remove_player(self, room_id: str, socket_id: str) -> Optional[str]:
        """Remove a player from a room. Returns player name if removed"""
        room = self.get_room(room_id)
        if not room:
            return None
        
        # Find player by socket_id
        player_to_remove = None
        for name, player in room.players.items():
            if player.socket_id == socket_id:
                player_to_remove = name
                break
        
        if player_to_remove:
            was_host = room.players[player_to_remove].is_host
            del room.players[player_to_remove]
            
            # If host left, assign new host (first remaining player)
            if was_host and len(room.players) > 0:
                first_player = list(room.players.values())[0]
                first_player.is_host = True
            
            # If drawer left, end the round
            if room.current_drawer == player_to_remove:
                room.current_drawer = None
                room.current_word = None
                if room.hint_timer:
                    room.hint_timer.cancel()
            
            # If no players left, cleanup room
            if len(room.players) == 0:
                del self.rooms[room_id]
            
            return player_to_remove
        return None
    
    def start_game(self, room_id: str) -> bool:
        """Start the game in a room"""
        room = self.get_room(room_id)
        if not room or len(room.players) < 2:
            return False
        
        if room.game_state != GameStateEnum.WAITING:
            return False
        
        room.game_state = GameStateEnum.IN_PROGRESS
        room.current_round = 1
        self.start_round(room_id)
        return True
    
    def start_round(self, room_id: str, category: str = None) -> bool:
        """Start a new round with a new drawer and word"""
        room = self.get_room(room_id)
        if not room or len(room.players) < 2:
            return False
        
        # Stop any existing timer
        if room.hint_timer:
            room.hint_timer.cancel()
        
        player_list = room.get_player_list()
        
        # Select next drawer (round-robin)
        if room.current_drawer:
            try:
                current_index = player_list.index(room.current_drawer)
                next_index = (current_index + 1) % len(player_list)
            except ValueError:
                next_index = 0
        else:
            next_index = 0
        
        room.current_drawer = player_list[next_index]
        drawer = room.players[room.current_drawer]
        drawer.is_drawer = True
        
        room.current_word = get_random_word(category)
        room.round_start_time = time.time()
        room.round_timer = 60
        room.revealed_letters = 0
        room.reset_guesses()
        room.word_category = category
        
        # Emit round start event
        if self.socketio:
            self.socketio.emit('round_start', {
                'drawer': room.current_drawer,
                'word_length': len(room.current_word),
                'round': room.current_round,
                'max_rounds': room.max_rounds
            }, room=room_id)
            
            # Send word to drawer only
            self.socketio.emit('your_word', {'word': room.current_word}, room=drawer.socket_id)
            
            # Start timer with hints
            self.start_timer(room_id)
        
        return True
    
    def start_timer(self, room_id: str):
        """Start the round timer with hint system"""
        room = self.get_room(room_id)
        if not room:
            return
        
        def timer_loop():
            start_time = time.time()
            elapsed = 0
            
            while elapsed < 60 and room.game_state == GameStateEnum.IN_PROGRESS:
                elapsed = time.time() - start_time
                time_left = max(0, 60 - elapsed)
                room.round_timer = int(time_left)
                
                if self.socketio:
                    # Emit timer update
                    self.socketio.emit('timer_update', {'time_left': int(time_left)}, room=room_id)
                    
                    # Hint at 30s (first letter)
                    if 29 <= time_left <= 30 and room.revealed_letters == 0:
                        room.revealed_letters = 1
                        self.socketio.emit('hint', {
                            'type': 'first_letter',
                            'letter': room.current_word[0],
                            'word_display': room.get_word_display()
                        }, room=room_id)
                    
                    # Hint at 15s (last letter)
                    elif 14 <= time_left <= 15 and room.revealed_letters == 1:
                        room.revealed_letters = 2
                        self.socketio.emit('hint', {
                            'type': 'last_letter',
                            'letter': room.current_word[-1],
                            'word_display': room.get_word_display()
                        }, room=room_id)
                    
                    # Hint at 10s (pattern with first and last)
                    elif 9 <= time_left <= 10 and room.revealed_letters == 2:
                        self.socketio.emit('hint', {
                            'type': 'pattern',
                            'pattern': room.get_word_display(),
                            'word_display': room.get_word_display()
                        }, room=room_id)
                
                time.sleep(0.5)  # Update every 500ms
            
            # Time's up
            if room.game_state == GameStateEnum.IN_PROGRESS:
                self.end_round(room_id)
        
        # Start timer in background thread
        timer_thread = threading.Thread(target=timer_loop, daemon=True)
        timer_thread.start()
        room.hint_timer = timer_thread
    
    def check_guess(self, room_id: str, player_name: str, guess: str) -> dict:
        """Check if a guess is correct. Returns result dict"""
        room = self.get_room(room_id)
        if not room or not room.current_word:
            return {"correct": False, "error": "No active game"}
        
        player = room.players.get(player_name)
        if not player:
            return {"correct": False, "error": "Player not found"}
        
        # Player can't guess if they're the drawer
        if player.is_drawer or player.name == room.current_drawer:
            return {"correct": False, "error": "You are the drawer"}
        
        # Player already guessed
        if player.has_guessed:
            return {"correct": False, "error": "Already guessed"}
        
        # Check for word similarity (anti-cheating)
        guess_normalized = guess.strip().lower()
        word_normalized = room.current_word.lower()
        
        # Check if guess is too similar (prevent cheating)
        similarity = SequenceMatcher(None, word_normalized, guess_normalized).ratio()
        if similarity > 0.8 and guess_normalized != word_normalized:
            return {"correct": False, "error": "Invalid guess", "censored": True}
        
        # Check if guess is correct
        is_correct = guess_normalized == word_normalized
        
        if is_correct:
            # Calculate points: base 100 + (time_left * 2)
            elapsed = time.time() - room.round_start_time
            time_left = max(0, 60 - elapsed)
            points = int(100 + (time_left * 2))
            
            player.has_guessed = True
            player.guess_time = time.time()
            player.score += points
            
            # Drawer gets bonus (50% of points)
            drawer = room.players.get(room.current_drawer)
            if drawer:
                drawer_bonus = int(points * 0.5)
                drawer.score += drawer_bonus
            
            # Check if everyone guessed (end round early)
            all_guessed = all(
                p.has_guessed or p.is_drawer or p.name == room.current_drawer
                for p in room.players.values()
            )
            
            return {
                "correct": True,
                "points": points,
                "drawer_bonus": drawer_bonus if drawer else 0,
                "word": room.current_word,
                "end_round": all_guessed,
                "scores": {name: p.score for name, p in room.players.items()}
            }
        else:
            return {"correct": False}
    
    def end_round(self, room_id: str) -> dict:
        """End current round and return results"""
        room = self.get_room(room_id)
        if not room:
            return {}
        
        # Stop timer
        if room.hint_timer:
            room.hint_timer.join(timeout=0.1)
            room.hint_timer = None
        
        results = {
            "drawer": room.current_drawer,
            "word": room.current_word,
            "scores": {name: p.score for name, p in room.players.items()},
            "round": room.current_round
        }
        
        # Emit round end
        if self.socketio:
            self.socketio.emit('round_end', results, room=room_id)
        
        # Reset flags
        room.reset_guesses()
        
        # Start next round or end game
        if room.current_round < room.max_rounds:
            room.current_round += 1
            # Small delay before next round
            import threading
            threading.Timer(3.0, lambda: self.start_round(room_id, room.word_category)).start()
        else:
            self.end_game(room_id)
        
        return results
    
    def end_game(self, room_id: str):
        """End the game and declare winner"""
        room = self.get_room(room_id)
        if not room:
            return
        
        room.game_state = GameStateEnum.FINISHED
        
        # Find winner
        winner = max(room.players.values(), key=lambda p: p.score)
        
        final_scores = [(p.name, p.score) for p in sorted(
            room.players.values(), 
            key=lambda p: p.score, 
            reverse=True
        )]
        
        if self.socketio:
            self.socketio.emit('game_over', {
                'winner': winner.name,
                'winner_score': winner.score,
                'final_scores': final_scores
            }, room=room_id)
    
    def get_game_state(self, room_id: str) -> Optional[dict]:
        """Get current game state for a room"""
        room = self.get_room(room_id)
        if not room:
            return None
        
        elapsed = 0
        if room.round_start_time:
            elapsed = time.time() - room.round_start_time
        
        time_remaining = max(0, 60 - elapsed)
        
        return {
            "room_id": room.room_id,
            "players": [p.to_dict() for p in room.players.values()],
            "current_drawer": room.current_drawer,
            "current_round": room.current_round,
            "max_rounds": room.max_rounds,
            "game_state": room.game_state.value,
            "time_remaining": int(time_remaining),
            "word_length": len(room.current_word) if room.current_word else 0,
            "word_display": room.get_word_display() if room.current_word else "",
            "host": room.get_host().name if room.get_host() else None
        }
    
    def is_similar_word(self, word: str, guess: str) -> bool:
        """Check if guess is too similar to word (anti-cheating)"""
        similarity = SequenceMatcher(None, word.lower(), guess.lower()).ratio()
        return similarity > 0.8

# Global game manager instance
game_manager = GameManager()
