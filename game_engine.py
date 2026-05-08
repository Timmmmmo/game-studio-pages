"""
Tower AI Arena - Game Engine
塔防AI对战平台游戏引擎
"""

import time
import math
import random
import config
import db

class GameEngine:
    """游戏引擎"""
    
    def __init__(self, game_id: str):
        self.game_id = game_id
        self.game = db.get_game(game_id)
        self.players = {}
        self.monsters = {}
        self.phase = "pending"  # pending, countdown, playing, ended
        self.time_remaining = config.GAME_DURATION
        self.current_wave = 0
        self.last_wave_time = 0
        self.last_update = time.time()
        self.monster_id_counter = 0
        
        # 加载玩家数据
        self._load_players()
        
    def _load_players(self):
        """加载玩家数据"""
        db_players = db.get_game_players(self.game_id)
        for p in db_players:
            player_id = p["id"]
            self.players[player_id] = {
                **p,
                "skills": {},
                "attack_cooldown": 0,
                "skill_cooldowns": {},
                "pos": self._get_tower_pos(p["tower_id"])
            }
            # 初始化技能冷却
            hero_config = config.HERO_TYPES.get(p["hero_type"], config.HERO_TYPES["warrior"])
            for skill in hero_config["skills"]:
                self.players[player_id]["skill_cooldowns"][skill["id"]] = 0
    
    def _get_tower_pos(self, tower_id: int) -> dict:
        """获取塔位坐标"""
        for t in config.TOWER_POSITIONS:
            if t["id"] == tower_id:
                return {"x": t["x"], "y": t["y"]}
        return {"x": 0.5, "y": 0.5}
    
    def _get_distance(self, x1, y1, x2, y2):
        """计算两点距离"""
        return math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    
    def _get_monsters_on_route(self, route: str) -> list:
        """获取指定路线上的怪物"""
        monsters = []
        db_monsters = db.get_game_monsters(self.game_id)
        for m in db_monsters:
            if m["route"] == route and m["hp"] > 0:
                monsters.append(m)
        return monsters
    
    def _generate_wave(self, wave_num: int):
        """生成一波怪物"""
        difficulty_mult = 1 + (wave_num // 5) * 0.2  # 每5波难度+20%
        
        # 普通怪数量随波次增加
        normal_count = 3 + wave_num // 3
        for i in range(normal_count):
            route = random.choice(["inner", "outer"])
            monster_type = "normal"
            monster_config = config.MONSTER_TYPES[monster_type]
            hp = int(monster_config["hp"] * difficulty_mult)
            
            db.spawn_monster(
                self.game_id, monster_type, route
            )
        
        # 精英怪(每3波)
        if wave_num % 3 == 0:
            route = random.choice(["inner", "outer"])
            monster_config = config.MONSTER_TYPES["elite"]
            hp = int(monster_config["hp"] * difficulty_mult)
            db.spawn_monster(self.game_id, "elite", route)
        
        # Boss(每5波)
        if wave_num % 5 == 0:
            route = random.choice(["inner", "outer"])
            monster_config = config.MONSTER_TYPES["boss"]
            hp = int(monster_config["hp"] * difficulty_mult)
            db.spawn_monster(self.game_id, "boss", route)
    
    def update(self):
        """更新游戏状态"""
        current_time = time.time()
        dt = current_time - self.last_update
        self.last_update = current_time
        
        if self.phase == "countdown":
            # 倒计时阶段
            elapsed = time.time() - (self.game.get("start_time") or time.time())
            if elapsed >= config.COUNTDOWN_DURATION:
                self.phase = "playing"
                db.update_game(self.game_id, phase="playing", start_time=time.time())
                self.current_wave = 1
                self._generate_wave(1)
        elif self.phase == "playing":
            # 游戏进行中
            self.time_remaining -= dt
            
            # 检查时间结束
            if self.time_remaining <= 0:
                self._end_game()
                return
            
            # 生成新一波怪物
            if time.time() - self.last_wave_time >= config.MONSTER_WAVE_INTERVAL:
                self.current_wave += 1
                self._generate_wave(self.current_wave)
                self.last_wave_time = time.time()
                db.update_game(self.game_id, current_wave=self.current_wave)
            
            # 更新怪物位置
            self._update_monsters(dt)
            
            # 处理玩家攻击
            self._update_players(dt)
            
            # 处理待处理指令
            self._process_pending_actions()
            
        return self.get_state()
    
    def _update_monsters(self, dt: float):
        """更新怪物位置"""
        db_monsters = db.get_game_monsters(self.game_id)
        for m in db_monsters:
            # 计算怪物移动
            monster_speed = m["speed"] * 0.001 * dt  # 速度因子
            
            # 检查是否被击中
            hero_pos = self._get_nearest_hero_pos(m["route"])
            if hero_pos:
                dist = self._get_distance(
                    m["progress"], 0.5,  # 怪物位置简化
                    hero_pos["x"], hero_pos["y"]
                )
                if dist <= 0.3:  # 在攻击范围内
                    continue  # 怪物会被攻击
            
            # 移动怪物
            new_progress = m["progress"] + monster_speed
            if new_progress >= 1.0:
                # 怪物到达终点，消失
                db.update_monster(m["id"], hp=0)
            else:
                db.update_monster(m["id"], progress=new_progress)
    
    def _get_nearest_hero_pos(self, route: str) -> dict:
        """获取最近的英雄位置(针对特定路线)"""
        # 简化：返回任意一个在附近范围的英雄
        for player in self.players.values():
            if player["alive"]:
                return player["pos"]
        return None
    
    def _update_players(self, dt: float):
        """更新玩家/英雄状态"""
        for player_id, player in self.players.items():
            if not player["alive"]:
                continue
            
            # 更新攻击冷却
            hero_config = config.HERO_TYPES.get(player["hero_type"], config.HERO_TYPES["warrior"])
            atk_spd = hero_config["spd"]
            player["attack_cooldown"] -= dt
            
            if player["attack_cooldown"] <= 0:
                # 攻击
                self._player_attack(player, player_id, hero_config)
                player["attack_cooldown"] = 1.0 / (atk_spd / 50)  # 转换为秒
            
            # 更新技能冷却
            for skill_id in player["skill_cooldowns"]:
                player["skill_cooldowns"][skill_id] -= dt
                if player["skill_cooldowns"][skill_id] < 0:
                    player["skill_cooldowns"][skill_id] = 0
            
            # 存活得分
            player["score"] += int(config.SCORE_SURVIVE_PER_SEC * dt)
            
            # 更新连击
            if time.time() - player["last_kill_time"] > 3:  # 3秒无击杀重置连击
                player["combo"] = 0
    
    def _player_attack(self, player: dict, player_id: str, hero_config: dict):
        """玩家攻击"""
        # 找到范围内的怪物
        player_x, player_y = player["pos"]["x"], player["pos"]["y"]
        player_range = hero_config["range"]
        
        monsters = db.get_game_monsters(self.game_id)
        target = None
        min_dist = float('inf')
        
        for m in monsters:
            if m["hp"] <= 0:
                continue
            
            # 获取怪物在路线上的大致位置
            route = config.ROUTES.get(m["route"], [])
            if not route:
                continue
            
            progress = m["progress"]
            route_idx = int(progress * (len(route) - 1))
            route_idx = min(route_idx, len(route) - 1)
            monster_pos = route[route_idx]
            
            dist = self._get_distance(player_x, player_y, monster_pos["x"], monster_pos["y"])
            
            if dist <= player_range and dist < min_dist:
                min_dist = dist
                target = m
        
        if target:
            # 计算伤害
            atk = hero_config["atk"]
            def_ = target["def"]
            dmg = max(1, atk - def_ * 0.5)
            
            # 暴击
            crit = random.random() < 0.15
            if crit:
                dmg *= 1.5
            
            new_hp = target["hp"] - dmg
            db.update_monster(target["id"], hp=new_hp)
            
            if new_hp <= 0:
                # 击杀
                self._handle_kill(player, player_id, target, crit)
    
    def _handle_kill(self, player: dict, player_id: str, monster: dict, crit: bool):
        """处理击杀"""
        monster_type = monster["type"]
        
        # 计算得分
        base_score = config.MONSTER_TYPES[monster_type]["score"]
        
        # 连击加成
        combo_mult = 1
        if time.time() - player["last_kill_time"] < 3:
            player["combo"] += 1
            combo_idx = min(player["combo"], len(config.SCORE_COMBO_MULT) - 1)
            combo_mult = config.SCORE_COMBO_MULT[combo_idx]
        
        player["last_kill_time"] = time.time()
        total_score = int(base_score * combo_mult)
        
        if crit:
            total_score += 50  # 暴击额外分
        
        # 更新数据库
        new_score = player["score"] + total_score
        new_kills = player["kills"] + 1
        db.update_player(player_id, score=new_score, kills=new_kills, combo=player["combo"])
        player["score"] = new_score
        player["kills"] = new_kills
        
        # 标记怪物死亡
        db.kill_monster(monster["id"], player_id)
    
    def _process_pending_actions(self):
        """处理待处理的AI指令"""
        for player_id, player in self.players.items():
            if not player["alive"]:
                continue
            
            actions = db.get_pending_actions(self.game_id, player["agent_id"])
            for action in actions:
                self._process_action(player, player_id, action)
                db.mark_action_processed(action["id"])
    
    def _process_action(self, player: dict, player_id: str, action: dict):
        """处理单个AI指令"""
        action_type = action["action_type"]
        params = eval(action["params"]) if action["params"] else {}
        
        hero_config = config.HERO_TYPES.get(player["hero_type"], config.HERO_TYPES["warrior"])
        
        if action_type == "move":
            # 移动到塔位
            tower_id = params.get("tower_id", player["tower_id"])
            tower_pos = self._get_tower_pos(tower_id)
            player["pos"] = tower_pos
            db.update_player(player_id, tower_id=tower_id)
        
        elif action_type == "skill":
            # 使用技能
            skill_id = params.get("skill_id")
            
            # 找到技能配置
            skill_config = None
            for skill in hero_config["skills"]:
                if skill["id"] == skill_id:
                    skill_config = skill
                    break
            
            if not skill_config:
                return
            
            # 检查冷却和MP
            if player["skill_cooldowns"].get(skill_id, 0) > 0:
                return  # 还在冷却
            
            if player["mp"] < skill_config["cost"]:
                return  # MP不足
            
            # 扣除MP，设置冷却
            new_mp = player["mp"] - skill_config["cost"]
            db.update_player(player_id, mp=new_mp)
            player["mp"] = new_mp
            player["skill_cooldowns"][skill_id] = skill_config["cd"]
            
            # 执行技能效果
            self._execute_skill(player, player_id, skill_config, hero_config, params)
    
    def _execute_skill(self, player: dict, player_id: str, skill: dict, hero_config: dict, params: dict):
        """执行技能效果"""
        target_x = params.get("target_x", player["pos"]["x"])
        target_y = params.get("target_y", player["pos"]["y"])
        skill_range = skill["aoe"] if skill["aoe"] > 0 else 0.3
        
        # 查找范围内的怪物
        monsters = db.get_game_monsters(self.game_id)
        hit_count = 0
        
        for m in monsters:
            if m["hp"] <= 0:
                continue
            
            route = config.ROUTES.get(m["route"], [])
            if not route:
                continue
            
            progress = m["progress"]
            route_idx = int(progress * (len(route) - 1))
            route_idx = min(route_idx, len(route) - 1)
            monster_pos = route[route_idx]
            
            dist = self._get_distance(target_x, target_y, monster_pos["x"], monster_pos["y"])
            
            if dist <= skill_range:
                # 造成伤害
                atk = hero_config["atk"]
                def_ = m["def"]
                dmg = max(1, atk * skill["dmg"] - def_ * 0.5)
                
                new_hp = m["hp"] - dmg
                db.update_monster(m["id"], hp=new_hp)
                hit_count += 1
                
                if new_hp <= 0:
                    self._handle_kill(player, player_id, m, False)
        
        # 技能击杀额外分
        if hit_count > 0:
            player["score"] += 50 * hit_count
            db.update_player(player_id, score=player["score"])
    
    def _end_game(self):
        """结束游戏"""
        self.phase = "ended"
        db.update_game(self.game_id, phase="ended", end_time=time.time(), status="finished")
        
        # 找出获胜者
        players = db.get_game_players(self.game_id)
        winner = max(players, key=lambda p: p["score"])
        
        db.update_game(self.game_id, winner_id=winner["agent_id"])
        db.update_room_status(self.game["room_id"], "ended")
        
        # 更新排行榜
        db.update_leaderboard(self.game_id)
        
        # 更新Agent统计
        for p in players:
            won = p["agent_id"] == winner["agent_id"]
            db.update_agent_stats(p["agent_id"], won, p["score"])
    
    def get_state(self) -> dict:
        """获取当前游戏状态"""
        players_data = []
        db_players = db.get_game_players(self.game_id)
        
        hero_configs = {
            "warrior": config.HERO_TYPES["warrior"],
            "archer": config.HERO_TYPES["archer"],
            "mage": config.HERO_TYPES["mage"]
        }
        
        for p in db_players:
            hero_config = hero_configs.get(p["hero_type"], config.HERO_TYPES["warrior"])
            skills_data = []
            for skill in hero_config["skills"]:
                cd_remaining = self.players.get(p["id"], {}).get("skill_cooldowns", {}).get(skill["id"], 0)
                skills_data.append({
                    "id": skill["id"],
                    "name": skill["name"],
                    "cooldown": max(0, cd_remaining),
                    "ready": cd_remaining <= 0,
                    "cost": skill["cost"]
                })
            
            players_data.append({
                "agent_id": p["agent_id"],
                "name": p.get("agent_name", "Unknown"),
                "hero_type": p["hero_type"],
                "tower_id": p["tower_id"],
                "hp": max(0, p["hp"]),
                "max_hp": p["max_hp"],
                "mp": max(0, p["mp"]),
                "max_mp": p["max_mp"],
                "score": p["score"],
                "kills": p["kills"],
                "alive": bool(p["alive"]),
                "skills": skills_data
            })
        
        # 按分数排序
        players_data.sort(key=lambda x: x["score"], reverse=True)
        
        # 获取怪物数据
        monsters_data = []
        db_monsters = db.get_game_monsters(self.game_id)
        for m in db_monsters:
            if m["hp"] > 0:
                monsters_data.append({
                    "id": m["id"],
                    "type": m["type"],
                    "hp": m["hp"],
                    "max_hp": m["max_hp"],
                    "route": m["route"],
                    "progress": m["progress"]
                })
        
        return {
            "game_id": self.game_id,
            "phase": self.phase,
            "time_remaining": max(0, self.time_remaining),
            "current_wave": self.current_wave,
            "players": players_data,
            "monsters": monsters_data,
            "leaderboard": [
                {"rank": i+1, **p}
                for i, p in enumerate(players_data[:4])
            ]
        }

# 全局游戏引擎实例缓存
_engines = {}

def get_engine(game_id: str) -> GameEngine:
    """获取或创建游戏引擎"""
    if game_id not in _engines:
        _engines[game_id] = GameEngine(game_id)
    return _engines[game_id]

def remove_engine(game_id: str):
    """移除游戏引擎"""
    if game_id in _engines:
        del _engines[game_id]
