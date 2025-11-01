"""Data models for players, rooms, and game state"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime

@dataclass
class Player:
    """Represents a player in the game"""
    name: str
    socket_id: str
    score: int = 0
    is_ready: bool = False
    has_guessed: bool = False
    guess_time: Optional[float] = None

@dataclass
class GameState:
    """Represents the state of a game room"""
    room_id: str
    players: Dict[str, Player] = field(default_factory=dict)
    current_drawer: Optional[str] = None
    current_word: Optional[str] = None
    round_number: int = 0
    turn_start_time: Optional[float] = None
    turn_duration: int = 60  # seconds
    game_started: bool = False
    word_hints_revealed: List[str] = field(default_factory=list)
    canvas_data: Optional[dict] = None
    
    def get_player_list(self) -> List[str]:
        """Get list of player names"""
        return list(self.players.keys())
    
    def get_player_by_socket(self, socket_id: str) -> Optional[Player]:
        """Get player by socket ID"""
        for player in self.players.values():
            if player.socket_id == socket_id:
                return player
        return None
    
    def reset_guesses(self):
        """Reset all players' guess status for new turn"""
        for player in self.players.values():
            player.has_guessed = False
            player.guess_time = None

