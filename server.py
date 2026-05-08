"""
Tower AI Arena - Lightweight HTTP Server
塔防AI对战平台 - 轻量级HTTP服务器 (使用Python标准库)
"""

import json
import sqlite3
import uuid
import time
import hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading
import config
import db

PORT = 18799
HOST = "0.0.0.0"

# 限流
RATE_LIMITS = {}

def check_rate_limit(agent_id: str) -> bool:
    now = time.time()
    if agent_id not in RATE_LIMITS:
        RATE_LIMITS[agent_id] = []
    RATE_LIMITS[agent_id] = [t for t in RATE_LIMITS[agent_id] if now - t < 1.0]
    if len(RATE_LIMITS[agent_id]) >= config.MAX_REQUESTS_PER_SECOND:
        return False
    RATE_LIMITS[agent_id].append(now)
    return True

def verify_auth(headers):
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    api_key = auth.replace("Bearer ", "")
    agent = db.get_agent_by_api_key(api_key)
    return agent["id"] if agent else None

class ArenaHandler(BaseHTTPRequestHandler):
    
    def log_message(self, fmt, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {fmt % args}")
    
    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
    
    def read_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            return json.loads(self.rfile.read(content_length))
        return {}
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
    
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        
        if path == "/health":
            self.send_json({"status": "ok", "service": "Tower AI Arena", "version": "1.0.0"})
        
        elif path == "/api/v1/rooms":
            rooms = db.list_waiting_rooms()
            self.send_json({"rooms": [
                {"room_id": r["id"], "name": r["name"], "max_agents": r["max_agents"], "player_count": r["player_count"], "status": r["status"]}
                for r in rooms
            ]})
        
        elif path.startswith("/api/v1/agents/"):
            agent_id = path.split("/")[-1]
            agent = db.get_agent(agent_id)
            if not agent:
                self.send_json({"error": "Agent not found"}, 404)
            else:
                self.send_json({
                    "agent_id": agent["id"], "name": agent["name"],
                    "hero_type": agent["hero_type"], "total_games": agent["total_games"],
                    "total_wins": agent["total_wins"], "total_score": agent["total_score"]
                })
        
        elif path.startswith("/api/v1/rooms/"):
            room_id = path.split("/")[-1]
            room = db.get_room(room_id)
            if not room:
                self.send_json({"error": "Room not found"}, 404)
            else:
                self.send_json({
                    "room_id": room["id"], "name": room["name"],
                    "status": room["status"], "max_agents": room["max_agents"]
                })
        
        elif path.startswith("/api/v1/games/"):
            parts = path.split("/")
            game_id = parts[3]
            if len(parts) == 5 and parts[4] == "result":
                game = db.get_game(game_id)
                if not game:
                    self.send_json({"error": "Game not found"}, 404)
                elif game["phase"] != "ended":
                    self.send_json({"error": "Game not ended"}, 400)
                else:
                    players = db.get_game_players(game_id)
                    self.send_json({
                        "game_id": game_id, "winner_id": game.get("winner_id"),
                        "rankings": [
                            {"rank": i+1, "agent_id": p["agent_id"], "name": p.get("agent_name", "?"), "score": p["score"], "kills": p["kills"]}
                            for i, p in enumerate(sorted(players, key=lambda x: x["score"], reverse=True))
                        ]
                    })
            else:
                game = db.get_game(game_id)
                if not game:
                    self.send_json({"error": "Game not found"}, 404)
                else:
                    from game_engine import get_engine
                    engine = get_engine(game_id)
                    state = engine.update()
                    self.send_json(state)
        
        elif path == "/api/v1/leaderboard":
            limit = int(params.get("limit", ["20"])[0])
            rankings = db.get_global_leaderboard(limit)
            self.send_json({"rankings": rankings})
        
        elif path == "/" or path == "/viewer":
            self.send_response(301)
            self.send_header("Location", "/viewer/index.html")
            self.end_headers()
        
        elif path.startswith("/viewer/") or path.startswith("/assets/"):
            # 静态文件
            import os
            if path.startswith("/viewer"):
                file_path = path[1:]
            else:
                file_path = path[1:]
            
            full_path = os.path.join(os.path.dirname(__file__), file_path)
            if os.path.exists(full_path) and os.path.isfile(full_path):
                with open(full_path, "rb") as f:
                    content = f.read()
                ext = os.path.splitext(full_path)[1]
                mime_types = {".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".png": "image/png"}
                self.send_response(200)
                self.send_header("Content-Type", mime_types.get(ext, "text/plain"))
                self.send_header("Content-Length", len(content))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_json({"error": "File not found"}, 404)
        
        else:
            self.send_json({"error": "Not found"}, 404)
    
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        
        if path == "/api/v1/register":
            name = params.get("name", [""])[0]
            if not name:
                body = self.read_json()
                name = body.get("name", "")
            if len(name) < 2:
                self.send_json({"error": "Name too short"}, 400)
                return
            result = db.create_agent(name)
            self.send_json({
                "success": True, "agent_id": result["agent_id"],
                "api_key": result["api_key"], "name": result["name"],
                "message": "Save your api_key securely!"
            })
        
        elif path.startswith("/api/v1/rooms/"):
            parts = path.split("/")
            room_id = parts[3]
            
            if len(parts) == 5 and parts[4] == "join":
                agent_id = verify_auth(self.headers)
                if not agent_id:
                    self.send_json({"error": "Unauthorized"}, 401)
                    return
                
                hero_type = params.get("hero_type", ["warrior"])[0]
                room = db.get_room(room_id)
                if not room:
                    self.send_json({"error": "Room not found"}, 404)
                elif room["status"] != "pending":
                    self.send_json({"error": "Room not accepting players"}, 400)
                else:
                    game = db.get_or_create_game_for_room(room_id)
                    existing = db.get_player_by_agent(game["id"], agent_id)
                    if existing:
                        self.send_json({"success": True, "game_id": game["id"], "player_id": existing["id"], "message": "Already joined"})
                    else:
                        player = db.add_player_to_game(game["id"], agent_id, hero_type)
                        self.send_json({"success": True, "game_id": game["id"], "room_id": room_id, "player_id": player["player_id"], "hero_type": hero_type})
            
            elif len(parts) == 4:  # POST /api/v1/rooms
                agent_id = verify_auth(self.headers)
                if not agent_id:
                    self.send_json({"error": "Unauthorized"}, 401)
                    return
                
                name = params.get("name", [None])[0]
                if not name:
                    body = self.read_json()
                    name = body.get("name")
                max_agents = int(params.get("max_agents", ["4"])[0])
                result = db.create_room(name, max_agents, agent_id)
                self.send_json({"success": True, "room_id": result["room_id"], "name": result["name"]})
        
        elif path.startswith("/api/v1/games/") and path.endswith("/actions"):
            parts = path.split("/")
            game_id = parts[3]
            
            agent_id = verify_auth(self.headers)
            if not agent_id:
                self.send_json({"error": "Unauthorized"}, 401)
                return
            
            if not check_rate_limit(agent_id):
                self.send_json({"error": "Rate limit exceeded"}, 429)
                return
            
            body = self.read_json()
            actions = body.get("actions", [])
            
            game = db.get_game(game_id)
            if not game:
                self.send_json({"error": "Game not found"}, 404)
            elif game["phase"] != "playing":
                self.send_json({"error": "Game not in playing phase"}, 400)
            else:
                player = db.get_player_by_agent(game_id, agent_id)
                if not player:
                    self.send_json({"error": "You are not in this game"}, 403)
                else:
                    processed = 0
                    for action in actions[:5]:
                        action_type = action.get("type")
                        if action_type in ["move", "skill"]:
                            db.add_action(game_id, agent_id, action_type, action)
                            processed += 1
                    self.send_json({"success": True, "processed": processed})
        
        elif path.startswith("/api/v1/agents/") and "/hero" in path:
            agent_id = path.split("/")[3]
            auth_agent = verify_auth(self.headers)
            if not auth_agent:
                self.send_json({"error": "Unauthorized"}, 401)
                return
            if auth_agent != agent_id:
                self.send_json({"error": "Forbidden"}, 403)
                return
            
            hero_type = params.get("hero_type", ["warrior"])[0]
            if hero_type not in config.HERO_TYPES:
                self.send_json({"error": f"Invalid hero type"}, 400)
                return
            
            conn = sqlite3.connect(db.DB_PATH)
            conn.execute("UPDATE agents SET hero_type = ? WHERE id = ?", (hero_type, agent_id))
            conn.commit()
            conn.close()
            self.send_json({"success": True, "hero_type": hero_type})
        
        else:
            self.send_json({"error": "Not found"}, 404)

def run_server():
    db.init_db()
    server = HTTPServer((HOST, PORT), ArenaHandler)
    print(f"🏰 Tower AI Arena 服务器已启动!")
    print(f"🌐 访问地址: http://localhost:{PORT}")
    print(f"📖 观战页面: http://localhost:{PORT}/viewer")
    print(f"📡 API文档: http://localhost:{PORT}/docs (简单文本版)")
    print("按 Ctrl+C 停止服务器\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
        server.shutdown()

if __name__ == "__main__":
    run_server()
