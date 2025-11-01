"""Word lists and category data for the game"""

# Word categories
WORDS = {
    "animals": [
        "dog", "cat", "elephant", "lion", "tiger", "bear", "rabbit", "monkey",
        "bird", "fish", "horse", "cow", "pig", "sheep", "goat", "chicken",
        "duck", "owl", "eagle", "whale", "shark", "dolphin", "penguin",
        "giraffe", "zebra", "hippo", "crocodile", "snake", "spider", "bee"
    ],
    "movies": [
        "batman", "superman", "spiderman", "titanic", "avatar", "matrix",
        "inception", "interstellar", "jurassic", "starwars", "harrypotter",
        "toy story", "frozen", "shrek", "finding nemo", "cars", "monsters inc",
        "iron man", "thor", "avengers", "transformers", "terminator",
        "jaws", "godzilla", "kong", "alien", "predator", "ghostbusters"
    ],
    "sports": [
        "football", "basketball", "soccer", "tennis", "baseball", "golf",
        "swimming", "running", "cycling", "volleyball", "hockey", "cricket",
        "rugby", "boxing", "wrestling", "surfing", "skiing", "skating",
        "bowling", "archery", "fencing", "judo", "karate", "ping pong",
        "badminton", "diving", "gymnastics", "marathon", "triathlon"
    ],
    "countries": [
        "usa", "canada", "mexico", "brazil", "argentina", "france", "germany",
        "italy", "spain", "uk", "russia", "china", "japan", "india", "australia",
        "egypt", "south africa", "kenya", "nigeria", "turkey", "greece",
        "thailand", "vietnam", "korea", "indonesia", "philippines", "south korea",
        "sweden", "norway", "finland", "denmark", "poland", "netherlands"
    ],
    "tech": [
        "computer", "smartphone", "tablet", "laptop", "keyboard", "mouse",
        "monitor", "printer", "router", "wifi", "bluetooth", "usb", "cable",
        "internet", "website", "app", "software", "hardware", "processor",
        "memory", "storage", "server", "cloud", "database", "algorithm",
        "programming", "coding", "developer", "software", "hardware"
    ],
    "general": [
        "house", "car", "tree", "sun", "moon", "star", "cloud", "rain", "snow",
        "flower", "butterfly", "cake", "pizza", "burger", "ice cream", "coffee",
        "book", "pen", "pencil", "paper", "chair", "table", "bed", "door",
        "window", "lamp", "clock", "phone", "camera", "tv", "radio", "music",
        "guitar", "piano", "drum", "violin", "microphone", "speaker", "headphones"
    ]
}

def get_random_word(category: str = None) -> str:
    """Get a random word from a category or all words"""
    import random
    
    if category and category in WORDS:
        return random.choice(WORDS[category]).upper()
    
    # Get random word from all categories
    all_words = []
    for words_list in WORDS.values():
        all_words.extend(words_list)
    
    return random.choice(all_words).upper()

def get_categories() -> List[str]:
    """Get list of available categories"""
    return list(WORDS.keys())

def get_words_by_category(category: str) -> List[str]:
    """Get all words from a specific category"""
    return WORDS.get(category, [])

