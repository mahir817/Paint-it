"""Game state management: rooms, turns, scoring"""

from typing import Dict, Optional
import random
import time
from server.models import GameState, Player
from server.words import get_random_word

class GameManager:
    """Manages all game rooms and their states"""
    
    def __init__(self):
        self.rooms: Dict[str, GameState] = {}
    
    def create_or_get_room(self, room_id: str) -> GameState:
        """Create a new room or return existing one"""
        if room_id not in self.rooms:
            self.rooms[room_id] = GameState(room_id=room_id)
        return self.rooms[room_id]
    
    def get_room(self, room_id: str) -> Optional[GameState]:
        """Get room by ID"""
        return self.rooms.get(room_id)
    
    def add_player(self, room_id: str, player_name: str, socket_id: str) -> bool:
        """Add a player to a room. Returns True if added, False if name taken"""
        room = self.create_or_get_room(room_id)
        
        # Check if name is already taken in this room
        if player_name in room.players:
            # If same socket, allow reconnection
            if room.players[player_name].socket_id == socket_id:
                room.players[player_name].socket_id = socket_id  # Update socket
                return True
            return False
        
        room.players[player_name] = Player(name=player_name, socket_id=socket_id)
        return True
    
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
            del room.players[player_to_remove]
            
            # If drawer left, end the turn
            if room.current_drawer == player_to_remove:
                room.current_drawer = None
                room.current_word = None
            
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
        
        room.game_started = True
        room.round_number = 1
        self.start_new_turn(room_id)
        return True
    
    def start_new_turn(self, room_id: str, category: str = None) -> bool:
        """Start a new turn with a new drawer and word"""
        room = self.get_room(room_id)
        if not room or len(room.players) < 2:
            return False
        
        player_list = room.get_player_list()
        
        # Choose next drawer (round-robin)
        if room.current_drawer:
            try:
                current_index = player_list.index(room.current_drawer)
                next_index = (current_index + 1) % len(player_list)
            except ValueError:
                next_index = 0
        else:
            next_index = 0
        
        room.current_drawer = player_list[next_index]
        room.current_word = get_random_word(category)
        room.turn_start_time = time.time()
        room.reset_guesses()
        room.word_hints_revealed = []
        room.canvas_data = None
        
        return True
    
    def end_turn(self, room_id: str) -> dict:
        """End current turn and calculate scores"""
        room = self.get_room(room_id)
        if not room:
            return {}
        
        # Calculate scores for drawer (based on how many guessed)
        drawer = room.players.get(room.current_drawer)
        if drawer:
            guesses_count = sum(1 for p in room.players.values() if p.has_guessed)
            # Drawer gets points based on successful guesses
            drawer_points = guesses_count * 10
            drawer.score += drawer_points
        
        # Prepare results
        results = {
            "drawer": room.current_drawer,
            "word": room.current_word,
            "scores": {name: p.score for name, p in room.players.items()}
        }
        
        # Move to next turn or round
        room.round_number += 1
        self.start_new_turn(room_id)
        
        return results
    
    def check_guess(self, room_id: str, player_name: str, guess: str) -> dict:
        """Check if a guess is correct. Returns result dict"""
        room = self.get_room(room_id)
        if not room or not room.current_word:
            return {"correct": False, "error": "No active game"}
        
        # Player can't guess if they're the drawer
        if player_name == room.current_drawer:
            return {"correct": False, "error": "You are the drawer"}
        
        # Player already guessed
        player = room.players.get(player_name)
        if not player or player.has_guessed:
            return {"correct": False, "error": "Already guessed"}
        
        # Check if guess is correct (case-insensitive, strip whitespace)
        guess_normalized = guess.strip().upper()
        word_normalized = room.current_word.upper()
        
        is_correct = guess_normalized == word_normalized
        
        if is_correct:
            # Calculate points based on time
            elapsed = time.time() - room.turn_start_time
            remaining_time = max(0, room.turn_duration - elapsed)
            
            # Points: faster guesses get more points (max 100)
            points = max(10, int(100 * (remaining_time / room.turn_duration)))
            
            player.has_guessed = True
            player.guess_time = time.time()
            player.score += points
            
            # Check if everyone guessed (end turn early)
            all_guessed = all(
                p.has_guessed or p.name == room.current_drawer
                for p in room.players.values()
            )
            
            return {
                "correct": True,
                "points": points,
                "word": room.current_word,
                "end_turn": all_guessed,
                "scores": {name: p.score for name, p in room.players.items()}
            }
        else:
            # Check for word censorship (prevent cheating)
            if self._contains_word(guess_normalized, word_normalized):
                return {"correct": False, "error": "Invalid guess", "censored": True}
            
            return {"correct": False}
    
    def _contains_word(self, text: str, word: str) -> bool:
        """Check if text contains the word (for anti-cheating)"""
        # Simple check: if word appears as substring
        return word in text or text in word
    
    def get_game_state(self, room_id: str) -> Optional[dict]:
        """Get current game state for a room"""
        room = self.get_room(room_id)
        if not room:
            return None
        
        elapsed = 0
        if room.turn_start_time:
            elapsed = time.time() - room.turn_start_time
        
        remaining = max(0, room.turn_duration - elapsed)
        
        return {
            "room_id": room.room_id,
            "players": {name: {"score": p.score, "has_guessed": p.has_guessed}
                       for name, p in room.players.items()},
            "current_drawer": room.current_drawer,
            "round_number": room.round_number,
            "game_started": room.game_started,
            "time_remaining": int(remaining),
            "word_length": len(room.current_word) if room.current_word else 0,
            "hints_revealed": room.word_hints_revealed
        }
    
    def reveal_hint(self, room_id: str) -> Optional[dict]:
        """Reveal a hint for the current word"""
        room = self.get_room(room_id)
        if not room or not room.current_word:
            return None
        
        word = room.current_word
        hints = room.word_hints_revealed
        
        # Reveal first letter if not revealed
        if len(hints) == 0 and len(word) > 0:
            hints.append(word[0])
            room.word_hints_revealed = hints
            return {"hint": word[0], "position": "first"}
        
        # Reveal last letter if first already revealed
        if len(hints) == 1 and len(word) > 1:
            hints.append(word[-1])
            room.word_hints_revealed = hints
            return {"hint": word[-1], "position": "last"}
        
        return None

# Global game manager instance
game_manager = GameManager()

