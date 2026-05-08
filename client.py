"""
Tower AI Arena - AI Client SDK
塔防AI对战平台 - AI客户端SDK (urllib fallback)
"""

import json
import time

def _http_request(method, url, headers=None, json_data=None):
    """HTTP client using urllib"""
    import urllib.request
    import urllib.error
    
    req_headers = dict(headers or {})
    body = None
    if json_data is not None:
        body = json.dumps(json_data).encode()
        req_headers["Content-Type"] = "application/json"
    
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        text = e.read().decode()
        raise Exception(f"HTTP {e.code}: {text}")
    except Exception as e:
        raise Exception(str(e))

class ArenaClient:
    """AI对战平台客户端"""
    
    def __init__(self, api_key: str, base_url: str = "http://localhost:18799"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def _request(self, method: str, path: str, json_data=None) -> dict:
        url = f"{self.base_url}{path}"
        return _http_request(method, url, headers=self.headers, json_data=json_data)
    
    # ============ Agent操作 ============
    
    def get_info(self, agent_id: str) -> dict:
        return self._request("GET", f"/api/v1/agents/{agent_id}")
    
    def set_hero(self, agent_id: str, hero_type: str) -> dict:
        return self._request("PUT", f"/api/v1/agents/{agent_id}/hero?hero_type={hero_type}")
    
    # ============ 房间操作 ============
    
    def create_room(self, name: str = None, max_agents: int = 4) -> dict:
        path = f"/api/v1/rooms?max_agents={max_agents}"
        if name:
            path += f"&name={name}"
        return self._request("POST", path)
    
    def list_rooms(self) -> list:
        result = self._request("GET", "/api/v1/rooms")
        return result.get("rooms", [])
    
    def join_room(self, room_id: str, hero_type: str = "warrior") -> dict:
        return self._request("POST", f"/api/v1/rooms/{room_id}/join?hero_type={hero_type}")
    
    # ============ 游戏操作 ============
    
    def get_state(self, game_id: str) -> dict:
        return self._request("GET", f"/api/v1/games/{game_id}/state")
    
    def submit_actions(self, game_id: str, actions: list) -> dict:
        return self._request("POST", f"/api/v1/games/{game_id}/actions", json_data={"actions": actions})
    
    def get_result(self, game_id: str) -> dict:
        return self._request("GET", f"/api/v1/games/{game_id}/result")
    
    # ============ 排行榜 ============
    
    def get_leaderboard(self, limit: int = 20) -> list:
        result = self._request("GET", f"/api/v1/leaderboard?limit={limit}")
        return result.get("rankings", [])

    # ============ 便捷方法 ============
    
    def auto_battle(self, game_id: str, interval: float = 0.5):
        """自动战斗循环"""
        my_agent_id = None
        last_move_time = 0
        
        while True:
            try:
                state = self.get_state(game_id)
                
                if state.get("phase") == "ended":
                    result = self.get_result(game_id)
                    print(f"🎮 游戏结束!")
                    for r in result.get("rankings", []):
                        print(f"  #{r['rank']}: {r['name']} - {r['score']}分")
                    break
                
                if my_agent_id is None:
                    for p in state.get("players", []):
                        if p.get("agent_id"):
                            my_agent_id = p["agent_id"]
                            break
                
                my_hero = None
                for p in state.get("players", []):
                    if p.get("agent_id") == my_agent_id:
                        my_hero = p
                        break
                
                if my_hero:
                    wave = state.get("current_wave", 0)
                    hp = my_hero.get("hp", 0)
                    max_hp = my_hero.get("max_hp", 1)
                    mp = my_hero.get("mp", 0)
                    max_mp = my_hero.get("max_mp", 1)
                    score = my_hero.get("score", 0)
                    kills = my_hero.get("kills", 0)
                    print(f"波次:{wave} | HP:{hp:.0f}/{max_hp} | MP:{mp:.0f}/{max_mp} | 分数:{score} | 击杀:{kills}")
                    
                    actions = []
                    current_time = time.time()
                    
                    # 技能策略
                    for skill in my_hero.get("skills", []):
                        if skill.get("ready") and mp >= skill.get("cost", 0):
                            actions.append({
                                "type": "skill",
                                "skill_id": skill.get("id"),
                                "target_x": 0.5,
                                "target_y": 0.5
                            })
                            break  # 一次只放一个技能
                    
                    # 移动策略 - 定期检查位置
                    if current_time - last_move_time > 10:
                        if my_hero.get("tower_id") != 2:
                            actions.append({"type": "move", "tower_id": 2})
                            last_move_time = current_time
                    
                    if actions:
                        self.submit_actions(game_id, actions)
                
                time.sleep(interval)
                
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(interval)


def quick_start(agent_name: str, hero_type: str = "warrior", base_url: str = "http://localhost:18799"):
    """快速开始 - 注册并加入游戏"""
    # 注册
    resp = _http_request("POST", f"{base_url}/api/v1/register?name={agent_name}")
    
    if "error" in resp:
        raise Exception(f"注册失败: {resp}")
    
    api_key = resp["api_key"]
    agent_id = resp["agent_id"]
    print(f"✅ Agent注册成功: {agent_name} (ID: {agent_id})")
    
    client = ArenaClient(api_key, base_url)
    
    # 设置英雄
    try:
        client.set_hero(agent_id, hero_type)
        print(f"✅ 英雄类型: {hero_type}")
    except:
        pass
    
    # 查找或创建房间
    rooms = client.list_rooms()
    if rooms:
        room_id = rooms[0]["room_id"]
        print(f"🔗 加入已有房间: {rooms[0]['name']}")
    else:
        result = client.create_room(f"{agent_name}'s Room")
        room_id = result["room_id"]
        print(f"🏠 创建新房间: {result['name']}")
    
    # 加入房间
    join_result = client.join_room(room_id, hero_type)
    game_id = join_result["game_id"]
    print(f"🎮 加入游戏: {game_id}")
    print(f"⏳ 等待游戏开始...")
    
    return client, game_id, agent_id


if __name__ == "__main__":
    print("=" * 50)
    print("Tower AI Arena - 客户端SDK测试")
    print("=" * 50)
    
    # 测试连接
    try:
        resp = _http_request("GET", "http://localhost:18799/health")
        print(f"✅ 服务器连接成功: {resp}")
    except Exception as e:
        print(f"❌ 无法连接到服务器: {e}")
        print("请先启动服务器: python server.py")
        exit(1)
    
    # 快速开始
    print("\n🚀 快速开始...")
    try:
        client, game_id, agent_id = quick_start("TestBot", "warrior")
        print("\n🎮 开始自动战斗...")
        client.auto_battle(game_id)
    except Exception as e:
        print(f"❌ 错误: {e}")
