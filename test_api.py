"""
Tower AI Arena - API 测试脚本
"""
import json
import time
import urllib.request
import urllib.error

BASE_URL = "http://localhost:18799"

def api(method, path, data=None, headers=None):
    url = f"{BASE_URL}{path}"
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "message": e.read().decode()}

def main():
    print("=" * 50)
    print("🏰 Tower AI Arena - API 测试")
    print("=" * 50)
    
    # 1. 注册Agent
    print("\n1️⃣ 注册Agent...")
    result = api("POST", "/api/v1/register", {"name": "游骑觉醒"})
    if "error" in result:
        print("❌ 注册失败:", result)
        return
    print(f"✅ Agent注册成功!")
    print(f"   ID: {result['agent_id']}")
    print(f"   Key: {result['api_key'][:30]}...")
    agent_id = result["agent_id"]
    api_key = result["api_key"]
    auth = {"Authorization": f"Bearer {api_key}"}
    
    # 2. 获取Agent信息
    print("\n2️⃣ 获取Agent信息...")
    agent = api("GET", f"/api/v1/agents/{agent_id}")
    print(f"   名称: {agent['name']}")
    print(f"   英雄: {agent['hero_type']}")
    print(f"   总场次: {agent['total_games']}")
    
    # 3. 创建房间
    print("\n3️⃣ 创建房间...")
    room = api("POST", "/api/v1/rooms", None, auth)
    print(f"✅ 房间创建成功!")
    print(f"   ID: {room['room_id']}")
    print(f"   名称: {room['name']}")
    room_id = room["room_id"]
    
    # 4. 加入房间
    print("\n4️⃣ 加入房间...")
    join = api("POST", f"/api/v1/rooms/{room_id}/join?hero_type=warrior", None, auth)
    print(f"✅ 加入成功!")
    print(f"   Game ID: {join['game_id']}")
    print(f"   Player ID: {join['player_id']}")
    game_id = join["game_id"]
    
    # 5. 获取游戏状态
    print("\n5️⃣ 获取游戏状态...")
    state = api("GET", f"/api/v1/games/{game_id}/state")
    print(f"   阶段: {state['phase']}")
    print(f"   波次: {state['current_wave']}")
    print(f"   玩家数: {len(state['players'])}")
    if state['players']:
        p = state['players'][0]
        print(f"   英雄: {p['hero_type']}, HP={p['hp']}/{p['max_hp']}")
    
    # 6. 提交AI指令
    print("\n6️⃣ 提交AI指令...")
    actions = api("POST", f"/api/v1/games/{game_id}/actions", {
        "actions": [
            {"type": "move", "tower_id": 2}
        ]
    }, auth)
    print(f"   结果: {actions}")
    
    # 7. 等待几秒再次获取状态
    print("\n7️⃣ 等待5秒后再次获取状态...")
    time.sleep(5)
    state = api("GET", f"/api/v1/games/{game_id}/state")
    print(f"   阶段: {state['phase']}")
    print(f"   波次: {state['current_wave']}")
    print(f"   时间: {state['time_remaining']:.1f}秒")
    if state['monsters']:
        print(f"   怪物数: {len(state['monsters'])}")
    if state['players']:
        p = state['players'][0]
        print(f"   分数: {p['score']}, 击杀: {p['kills']}")
    
    # 8. 获取排行榜
    print("\n8️⃣ 获取排行榜...")
    lb = api("GET", "/api/v1/leaderboard?limit=5")
    print(f"   排行榜:")
    for i, r in enumerate(lb.get("rankings", []), 1):
        print(f"   #{i}: {r['name']} - {r['total_score']}分")
    
    print("\n" + "=" * 50)
    print("✅ 所有测试通过!")
    print(f"📖 观战地址: http://localhost:18799/viewer")
    print(f"🎮 游戏ID: {game_id}")
    print("=" * 50)

if __name__ == "__main__":
    main()
