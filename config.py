"""
Tower AI Arena - Configuration
塔防AI对战平台配置文件
"""

# 服务器配置
HOST = "0.0.0.0"
PORT = 18799
DEBUG = True

# 游戏配置
GAME_DURATION = 180  # 游戏时长(秒)
MONSTER_WAVE_INTERVAL = 6  # 怪物波次间隔(秒)
MAX_AGENTS_PER_ROOM = 4  # 每房间最大AI数量
COUNTDOWN_DURATION = 10  # 等待时长(秒)

# API限流
MAX_REQUESTS_PER_SECOND = 5  # 每秒最大请求数
ACTION_DELAY = 0.5  # 指令延迟(秒)

# 英雄类型
HERO_TYPES = {
    "warrior": {
        "name": "战士",
        "hp": 1000,
        "atk": 80,
        "def": 30,
        "spd": 50,
        "range": 0.45,
        "skills": [
            {"id": "earth_split", "name": "裂地击", "cd": 7, "dmg": 3.5, "aoe": 0.5, "cost": 75},
            {"id": "spin", "name": "旋风斩", "cd": 18, "dmg": 5.0, "aoe": 0.8, "cost": 150}
        ]
    },
    "archer": {
        "name": "弓手",
        "hp": 700,
        "atk": 100,
        "def": 15,
        "spd": 70,
        "range": 0.70,
        "skills": [
            {"id": "pierce", "name": "穿云箭", "cd": 7, "dmg": 2.0, "aoe": 0.0, "cost": 75},
            {"id": "rain", "name": "箭雨", "cd": 18, "dmg": 1.5, "aoe": 1.0, "cost": 150}
        ]
    },
    "mage": {
        "name": "法师",
        "hp": 800,
        "atk": 120,
        "def": 10,
        "spd": 55,
        "range": 0.55,
        "skills": [
            {"id": "arcane", "name": "奥术爆破", "cd": 7, "dmg": 4.0, "aoe": 0.5, "cost": 75},
            {"id": "meteor", "name": "陨石雨", "cd": 18, "dmg": 6.0, "aoe": 0.7, "cost": 150}
        ]
    }
}

# 怪物类型
MONSTER_TYPES = {
    "normal": {"hp": 100, "atk": 0, "def": 0, "spd": 0.3, "score": 100},
    "elite": {"hp": 500, "atk": 0, "def": 20, "spd": 0.2, "score": 300},
    "boss": {"hp": 3000, "atk": 0, "def": 50, "spd": 0.1, "score": 1000}
}

# 塔位配置
TOWER_POSITIONS = [
    {"id": 0, "x": 0.15, "y": 0.18, "name": "左上"},
    {"id": 1, "x": 0.85, "y": 0.18, "name": "右上"},
    {"id": 2, "x": 0.5, "y": 0.5, "name": "中心"},
    {"id": 3, "x": 0.15, "y": 0.82, "name": "左下"},
    {"id": 4, "x": 0.85, "y": 0.82, "name": "右下"}
]

# 路线配置
ROUTES = {
    "inner": [
        {"x": 0.25, "y": 0.28},
        {"x": 0.75, "y": 0.28},
        {"x": 0.75, "y": 0.72},
        {"x": 0.25, "y": 0.72}
    ],
    "outer": [
        {"x": 0.08, "y": 0.09},
        {"x": 0.92, "y": 0.09},
        {"x": 0.92, "y": 0.91},
        {"x": 0.08, "y": 0.91}
    ]
}

# 计分配置
SCORE_KILL_NORMAL = 100
SCORE_KILL_ELITE = 300
SCORE_KILL_BOSS = 1000
SCORE_SURVIVE_PER_SEC = 5
SCORE_COMBO_MULT = [1, 1.5, 2, 2.5, 3]
