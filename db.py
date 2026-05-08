"""
Tower AI Arena - Database Models
塔防AI对战平台数据模型
"""

import sqlite3
import uuid
import time
from datetime import datetime
from contextlib import contextmanager
import config

DB_PATH = "arena.db"

def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@contextmanager
def get_cursor():
    """上下文管理器，自动提交/关闭"""
    conn = get_db()
    try:
        yield conn.cursor()
        conn.commit()
    finally:
        conn.close()

def init_db():
    """初始化数据库表"""
    with get_cursor() as cur:
        # Agent表
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                avatar_url TEXT,
                api_key TEXT UNIQUE NOT NULL,
                hero_type TEXT DEFAULT 'warrior',
                created_at TEXT NOT NULL,
                total_games INTEGER DEFAULT 0,
                total_wins INTEGER DEFAULT 0,
                total_score INTEGER DEFAULT 0
            )
        """)
        
        # 房间表
        cur.execute("""
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                name TEXT,
                status TEXT DEFAULT 'pending',
                max_agents INTEGER DEFAULT 4,
                created_by TEXT,
                created_at TEXT NOT NULL,
                started_at TEXT,
                ended_at TEXT
            )
        """)
        
        # 游戏表
        cur.execute("""
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                room_id TEXT,
                status TEXT DEFAULT 'waiting',
                phase TEXT DEFAULT 'pending',
                start_time REAL,
                end_time REAL,
                current_wave INTEGER DEFAULT 0,
                duration INTEGER DEFAULT 180,
                winner_id TEXT,
                created_at TEXT NOT NULL
            )
        """)
        
        # 玩家(游戏中的英雄)表
        cur.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                hero_type TEXT NOT NULL,
                tower_id INTEGER DEFAULT 2,
                hp REAL DEFAULT 1000,
                max_hp REAL DEFAULT 1000,
                mp REAL DEFAULT 300,
                max_mp REAL DEFAULT 300,
                score INTEGER DEFAULT 0,
                kills INTEGER DEFAULT 0,
                gold INTEGER DEFAULT 50,
                combo INTEGER DEFAULT 0,
                last_kill_time REAL DEFAULT 0,
                alive INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            )
        """)
        
        # 怪物表
        cur.execute("""
            CREATE TABLE IF NOT EXISTS monsters (
                id TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                type TEXT NOT NULL,
                hp REAL NOT NULL,
                max_hp REAL NOT NULL,
                route TEXT NOT NULL,
                progress REAL DEFAULT 0,
                speed REAL NOT NULL,
                reward INTEGER DEFAULT 100,
                killed_by TEXT,
                created_at TEXT NOT NULL
            )
        """)
        
        # AI指令表
        cur.execute("""
            CREATE TABLE IF NOT EXISTS actions (
                id TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                agent_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                params TEXT,
                processed INTEGER DEFAULT 0,
                created_at REAL NOT NULL
            )
        """)
        
        # 排行榜
        cur.execute("""
            CREATE TABLE IF NOT EXISTS leaderboard (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id TEXT NOT NULL,
                score INTEGER DEFAULT 0,
                rank INTEGER,
                game_id TEXT,
                created_at TEXT NOT NULL
            )
        """)
        
        print("✅ 数据库初始化完成")

def generate_id(prefix=""):
    """生成带前缀的UUID"""
    return f"{prefix}{uuid.uuid4().hex[:12]}"

def generate_api_key():
    """生成API Key"""
    return f"sk_{uuid.uuid4().hex}"

# ============ Agent操作 ============

def create_agent(name: str, avatar_url: str = None) -> dict:
    """创建新Agent"""
    agent_id = generate_id("ag_")
    api_key = generate_api_key()
    
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO agents (id, name, avatar_url, api_key, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (agent_id, name, avatar_url, api_key, datetime.now().isoformat()))
    
    return {
        "agent_id": agent_id,
        "api_key": api_key,
        "name": name
    }

def get_agent_by_api_key(api_key: str) -> dict:
    """通过API Key获取Agent"""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM agents WHERE api_key = ?", (api_key,))
        row = cur.fetchone()
        return dict(row) if row else None

def get_agent(agent_id: str) -> dict:
    """获取Agent信息"""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
        row = cur.fetchone()
        return dict(row) if row else None

def update_agent_stats(agent_id: str, won: bool, score: int):
    """更新Agent统计"""
    with get_cursor() as cur:
        cur.execute("""
            UPDATE agents 
            SET total_games = total_games + 1,
                total_wins = total_wins + ?,
                total_score = total_score + ?
            WHERE id = ?
        """, (1 if won else 0, score, agent_id))

# ============ Room操作 ============

def create_room(name: str = None, max_agents: int = 4, created_by: str = None) -> dict:
    """创建房间"""
    room_id = generate_id("rm_")
    
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO rooms (id, name, max_agents, created_by, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (room_id, name or f"Room_{room_id[:8]}", max_agents, created_by, datetime.now().isoformat()))
    
    return {"room_id": room_id, "name": name or f"Room_{room_id[:8]}"}

def get_room(room_id: str) -> dict:
    """获取房间信息"""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM rooms WHERE id = ?", (room_id,))
        row = cur.fetchone()
        return dict(row) if row else None

def list_waiting_rooms() -> list:
    """列出等待中的房间"""
    with get_cursor() as cur:
        cur.execute("""
            SELECT r.*, COUNT(DISTINCT g.id) as player_count
            FROM rooms r
            LEFT JOIN games g ON g.room_id = r.id AND g.status = 'active'
            WHERE r.status = 'pending'
            GROUP BY r.id
            ORDER BY r.created_at DESC
            LIMIT 20
        """)
        rows = cur.fetchall()
        return [dict(row) for row in rows]

def update_room_status(room_id: str, status: str):
    """更新房间状态"""
    with get_cursor() as cur:
        cur.execute("UPDATE rooms SET status = ? WHERE id = ?", (status, room_id))

# ============ Game操作 ============

def create_game(room_id: str, duration: int = 180) -> dict:
    """创建游戏"""
    game_id = generate_id("gm_")
    
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO games (id, room_id, duration, created_at)
            VALUES (?, ?, ?, ?)
        """, (game_id, room_id, duration, datetime.now().isoformat()))
    
    return {"game_id": game_id}

def get_game(game_id: str) -> dict:
    """获取游戏信息"""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM games WHERE id = ?", (game_id,))
        row = cur.fetchone()
        return dict(row) if row else None

def get_or_create_game_for_room(room_id: str) -> dict:
    """获取或创建房间的游戏"""
    with get_cursor() as cur:
        cur.execute("""
            SELECT * FROM games WHERE room_id = ? AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
        """, (room_id,))
        row = cur.fetchone()
        
        if row:
            return dict(row)
        
        # 创建新游戏
        game_id = generate_id("gm_")
        cur.execute("""
            INSERT INTO games (id, room_id, status, phase, created_at)
            VALUES (?, ?, 'active', 'countdown', ?)
        """, (game_id, room_id, datetime.now().isoformat()))
        
        return {"id": game_id, "room_id": room_id, "status": "active", "phase": "countdown"}

def add_player_to_game(game_id: str, agent_id: str, hero_type: str = "warrior") -> dict:
    """添加玩家到游戏"""
    player_id = generate_id("pl_")
    hero_config = config.HERO_TYPES.get(hero_type, config.HERO_TYPES["warrior"])
    
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO players (id, game_id, agent_id, hero_type, hp, max_hp, mp, max_mp, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            player_id, game_id, agent_id, hero_type,
            hero_config["hp"], hero_config["hp"],
            hero_config.get("mp", 300), hero_config.get("mp", 300),
            datetime.now().isoformat()
        ))
    
    return {"player_id": player_id, "hero_type": hero_type}

def get_game_players(game_id: str) -> list:
    """获取游戏中的所有玩家"""
    with get_cursor() as cur:
        cur.execute("""
            SELECT p.*, a.name as agent_name
            FROM players p
            JOIN agents a ON a.id = p.agent_id
            WHERE p.game_id = ?
            ORDER BY p.score DESC
        """, (game_id,))
        rows = cur.fetchall()
        return [dict(row) for row in rows]

def get_player_by_agent(game_id: str, agent_id: str) -> dict:
    """通过Agent获取游戏中的玩家"""
    with get_cursor() as cur:
        cur.execute("""
            SELECT * FROM players WHERE game_id = ? AND agent_id = ?
        """, (game_id, agent_id))
        row = cur.fetchone()
        return dict(row) if row else None

def update_player(player_id: str, **kwargs):
    """更新玩家数据"""
    if not kwargs:
        return
    
    fields = ", ".join([f"{k} = ?" for k in kwargs.keys()])
    values = list(kwargs.values()) + [player_id]
    
    with get_cursor() as cur:
        cur.execute(f"UPDATE players SET {fields} WHERE id = ?", values)

def update_game(game_id: str, **kwargs):
    """更新游戏数据"""
    if not kwargs:
        return
    
    fields = ", ".join([f"{k} = ?" for k in kwargs.keys()])
    values = list(kwargs.values()) + [game_id]
    
    with get_cursor() as cur:
        cur.execute(f"UPDATE games SET {fields} WHERE id = ?", values)

# ============ Monster操作 ============

def spawn_monster(game_id: str, monster_type: str, route: str) -> dict:
    """生成怪物"""
    monster_id = generate_id("mn_")
    monster_config = config.MONSTER_TYPES.get(monster_type, config.MONSTER_TYPES["normal"])
    
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO monsters (id, game_id, type, hp, max_hp, route, speed, reward, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            monster_id, game_id, monster_type,
            monster_config["hp"], monster_config["hp"],
            route, monster_config["spd"], monster_config["score"],
            datetime.now().isoformat()
        ))
    
    return {"monster_id": monster_id, "type": monster_type}

def get_game_monsters(game_id: str) -> list:
    """获取游戏中的所有怪物"""
    with get_cursor() as cur:
        cur.execute("""
            SELECT * FROM monsters 
            WHERE game_id = ? AND hp > 0
            ORDER BY route, progress
        """, (game_id,))
        rows = cur.fetchall()
        return [dict(row) for row in rows]

def update_monster(monster_id: str, **kwargs):
    """更新怪物数据"""
    if not kwargs:
        return
    
    fields = ", ".join([f"{k} = ?" for k in kwargs.keys()])
    values = list(kwargs.values()) + [monster_id]
    
    with get_cursor() as cur:
        cur.execute(f"UPDATE monsters SET {fields} WHERE id = ?", values)

def kill_monster(monster_id: str, killer_id: str):
    """击杀怪物"""
    with get_cursor() as cur:
        cur.execute("UPDATE monsters SET hp = 0, killed_by = ? WHERE id = ?", (killer_id, monster_id))

# ============ Action操作 ============

def add_action(game_id: str, agent_id: str, action_type: str, params: dict) -> dict:
    """添加AI指令"""
    action_id = generate_id("ac_")
    
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO actions (id, game_id, agent_id, action_type, params, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (action_id, game_id, agent_id, action_type, str(params), time.time()))
    
    return {"action_id": action_id}

def get_pending_actions(game_id: str, agent_id: str) -> list:
    """获取待处理的指令"""
    with get_cursor() as cur:
        cur.execute("""
            SELECT * FROM actions 
            WHERE game_id = ? AND agent_id = ? AND processed = 0
            ORDER BY created_at ASC
        """, (game_id, agent_id))
        rows = cur.fetchall()
        return [dict(row) for row in rows]

def mark_action_processed(action_id: str):
    """标记指令已处理"""
    with get_cursor() as cur:
        cur.execute("UPDATE actions SET processed = 1 WHERE id = ?", (action_id,))

# ============ Leaderboard操作 ============

def update_leaderboard(game_id: str):
    """更新排行榜"""
    with get_cursor() as cur:
        # 获取当前排名
        cur.execute("""
            SELECT agent_id, score FROM players 
            WHERE game_id = ? AND alive = 1
            ORDER BY score DESC
        """, (game_id,))
        rows = cur.fetchall()
        
        # 插入排行榜
        for rank, row in enumerate(rows, 1):
            cur.execute("""
                INSERT INTO leaderboard (agent_id, score, rank, game_id, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (row["agent_id"], row["score"], rank, game_id, datetime.now().isoformat()))

def get_global_leaderboard(limit: int = 20) -> list:
    """获取全局排行榜"""
    with get_cursor() as cur:
        cur.execute("""
            SELECT a.id, a.name, SUM(l.score) as total_score,
                   COUNT(l.game_id) as games, SUM(CASE WHEN l.rank = 1 THEN 1 ELSE 0 END) as wins
            FROM leaderboard l
            JOIN agents a ON a.id = l.agent_id
            GROUP BY a.id
            ORDER BY total_score DESC
            LIMIT ?
        """, (limit,))
        rows = cur.fetchall()
        return [dict(row) for row in rows]

if __name__ == "__main__":
    init_db()
    print("数据库初始化测试完成")
