"""Data models for players, rooms, and game state"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum

class GameStateEnum(str, Enum):
    """Game state enumeration"""
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"

@dataclass
class Player:
    """Represents a player in the game"""
    name: str
    socket_id: str
    score: int = 0
    is_drawer: bool = False
    has_guessed: bool = False
    guess_time: Optional[float] = None
    avatar: Optional[str] = None
    is_host: bool = False  # First player is host
    
    def to_dict(self) -> dict:
        """Convert player to dictionary"""
        return {
            'name': self.name,
            'score': self.score,
            'is_drawer': self.is_drawer,
            'has_guessed': self.has_guessed,
            'avatar': self.avatar,
            'is_host': self.is_host
        }

@dataclass
class GameState:
    """Represents the state of a game room"""
    room_id: str
    players: Dict[str, Player] = field(default_factory=dict)
    current_drawer: Optional[str] = None
    current_word: Optional[str] = None
    current_round: int = 0
    max_rounds: int = 5  # Default 5 rounds
    round_timer: int = 60  # seconds
    round_start_time: Optional[float] = None
    game_state: GameStateEnum = GameStateEnum.WAITING
    word_category: Optional[str] = None
    revealed_letters: int = 0  # Number of letters revealed via hints
    hint_timer: Optional[object] = None  # Timer thread for hints
    canvas_data: Optional[dict] = None
    
    def get_player_list(self) -> List[str]:
        """Get list of player names"""
        return list(self.players.keys())
    
    def get_host(self) -> Optional[Player]:
        """Get the host player (first player)"""
        for player in self.players.values():
            if player.is_host:
                return player
        return None
    
    def get_player_by_socket(self, socket_id: str) -> Optional[Player]:
        """Get player by socket ID"""
        for player in self.players.values():
            if player.socket_id == socket_id:
                return player
        return None
    
    def reset_guesses(self):
        """Reset all players' guess status for new round"""
        for player in self.players.values():
            player.has_guessed = False
            player.guess_time = None
            player.is_drawer = False
    
    def get_word_display(self) -> str:
        """Get word display for non-drawers (blanks with hints)"""
        if not self.current_word:
            return ""
        
        word = self.current_word.upper()
        display = []
        revealed_letters = self.revealed_letters
        
        # At 30s: first letter
        # At 15s: last letter  
        # At 10s: first and last, plus pattern
        has_first = revealed_letters >= 1
        has_last = revealed_letters >= 2
        
        for i, char in enumerate(word):
            if i == 0 and has_first:
                display.append(char)
            elif i == len(word) - 1 and has_last:
                display.append(char)
            else:
                display.append('_')
        
        return ' '.join(display)

