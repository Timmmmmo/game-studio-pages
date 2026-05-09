#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
魔兽争霸风格兵种对战 - Tower Defense AI Arena
WarCraft-Style Unit Counter Battle

兵种护甲类型：
- 无甲 (none)
- 轻甲 (light)
- 中甲 (medium)
- 重甲 (heavy)
- 城防 (fortified)

攻击类型：
- 普通攻击 (normal) - 克制轻甲、中甲
- 穿刺攻击 (pierce) - 克制无甲、轻甲
- 魔法攻击 (magic) - 克制轻甲、中甲、城防
- 攻城攻击 (siege) - 克制中甲、城防
- 英雄攻击 (hero) - 克制所有

相克关系（伤害倍率）：
- 普通攻击 → 轻甲/中甲: 1.5x, 城防: 0.5x
- 穿刺攻击 → 无甲/轻甲: 1.5x, 中甲/重甲: 0.7x, 城防: 0.3x
- 魔法攻击 → 轻甲/中甲: 1.5x, 重甲: 1.2x, 城防: 0.5x, 英雄: 0.5x
- 攻城攻击 → 城防: 2.0x, 中甲/重甲: 1.5x, 英雄: 0.3x, 其他: 0.5x
"""

# ============================================================
# 兵种定义
# ============================================================

UNIT_TYPES = {
    # 步兵 - 普通攻击，中甲
    "footman": {
        "name": "步兵",
        "cost": 100,
        "hp": 500,
        "damage": 25,
        "attack_type": "normal",
        "armor_type": "medium",
        "armor": 5,
        "range": "melee",
        "speed": 280,
        "icon": "⚔️"
    },
    
    # 弓箭手 - 穿刺攻击，无甲
    "archer": {
        "name": "弓箭手",
        "cost": 120,
        "hp": 300,
        "damage": 20,
        "attack_type": "pierce",
        "armor_type": "light",
        "armor": 0,
        "range": "ranged",
        "speed": 320,
        "icon": "🏹"
    },
    
    # 法师 - 魔法攻击，无甲（脆弱但克制重甲）
    "mage": {
        "name": "法师",
        "cost": 150,
        "hp": 280,
        "damage": 35,
        "attack_type": "magic",
        "armor_type": "none",
        "armor": 0,
        "range": "ranged",
        "speed": 300,
        "icon": "🔮"
    },
    
    # 骑士 - 普通攻击，重甲（肉盾）
    "knight": {
        "name": "骑士",
        "cost": 200,
        "hp": 900,
        "damage": 40,
        "attack_type": "normal",
        "armor_type": "heavy",
        "armor": 10,
        "range": "melee",
        "speed": 250,
        "icon": "🛡️"
    },
    
    # 投石车 - 攻城攻击，城防甲（拆家专用）
    "siege_engine": {
        "name": "投石车",
        "cost": 180,
        "hp": 400,
        "damage": 70,
        "attack_type": "siege",
        "armor_type": "fortified",
        "armor": 8,
        "range": "ranged",
        "speed": 200,
        "icon": "💥"
    },
}

# ============================================================
# 相克表 (攻击类型 vs 护甲类型)
# ============================================================

DAMAGE_MULTIPLIERS = {
    "normal": {
        "none": 1.0,
        "light": 1.5,
        "medium": 1.5,
        "heavy": 1.0,
        "fortified": 0.5,
    },
    "pierce": {
        "none": 1.5,
        "light": 1.5,
        "medium": 0.7,
        "heavy": 0.7,
        "fortified": 0.3,
    },
    "magic": {
        "none": 1.0,
        "light": 1.5,
        "medium": 1.5,
        "heavy": 1.2,
        "fortified": 0.5,
    },
    "siege": {
        "none": 0.5,
        "light": 0.5,
        "medium": 1.5,
        "heavy": 1.5,
        "fortified": 2.0,
    },
}

def get_damage_multiplier(attack_type, armor_type):
    """获取攻击对护甲的伤害倍率"""
    return DAMAGE_MULTIPLIERS.get(attack_type, {}).get(armor_type, 1.0)


# ============================================================
# 单位实例类
# ============================================================

class Unit:
    """战斗单位"""
    def __init__(self, unit_type, owner):
        self.unit_type = unit_type
        self.owner = owner  # "player1" or "player2"
        
        template = UNIT_TYPES[unit_type]
        self.name = template["name"]
        self.cost = template["cost"]
        self.max_hp = template["hp"]
        self.hp = template["hp"]
        self.base_damage = template["damage"]
        self.attack_type = template["attack_type"]
        self.armor_type = template["armor_type"]
        self.armor = template["armor"]
        self.range = template["range"]
        self.speed = template["speed"]
        self.icon = template["icon"]
        
        self.pos = 0  # 位置（0 = 最前面）
        self.target = None  # 当前目标
        self.is_dead = False
    
    @property
    def damage(self):
        """实际伤害 = 基础伤害 × 相克倍率"""
        if self.target:
            return self.base_damage * get_damage_multiplier(self.attack_type, self.target.armor_type)
        return self.base_damage
    
    def take_damage(self, damage):
        """受到伤害"""
        # 护甲减伤
        actual_damage = max(1, damage - self.armor)
        self.hp -= actual_damage
        
        if self.hp <= 0:
            self.hp = 0
            self.is_dead = True
            return True  # 死亡
        return False
    
    def find_target(self, enemies):
        """寻找最近的目标（优先攻击相克的目标）"""
        if not enemies:
            return None
        
        best_target = None
        best_score = -1
        
        for enemy in enemies:
            if enemy.is_dead:
                continue
            
            # 计算优先级分数
            score = 0
            
            # 相克加成
            multiplier = get_damage_multiplier(self.attack_type, enemy.armor_type)
            score += multiplier * 100
            
            # 优先攻击低血量
            score += (100 - enemy.hp / enemy.max_hp * 100)
            
            # 优先攻击脆皮
            score += (200 - enemy.max_hp) / 10
            
            # 优先攻击前排
            score -= enemy.pos * 5
            
            if score > best_score:
                best_score = score
                best_target = enemy
        
        return best_target
    
    def update(self, enemies):
        """更新状态"""
        if self.is_dead:
            return
        
        # 寻找目标
        self.target = self.find_target(enemies)
        
        if self.target:
            # 攻击目标
            damage_dealt = self.target.take_damage(self.damage)
            
            # 返回攻击信息
            return {
                "attacker": self.unit_type,
                "target": self.target.unit_type,
                "damage": self.damage,
                "killed": damage_dealt,
                "target_hp": self.target.hp,
                "target_max_hp": self.target.max_hp
            }
        
        return None
    
    def to_dict(self):
        """转换为字典"""
        return {
            "unit_type": self.unit_type,
            "owner": self.owner,
            "name": self.name,
            "hp": self.hp,
            "max_hp": self.max_hp,
            "hp_percent": round(self.hp / self.max_hp * 100, 1),
            "damage": self.base_damage,
            "attack_type": self.attack_type,
            "armor_type": self.armor_type,
            "armor": self.armor,
            "range": self.range,
            "icon": self.icon,
            "pos": self.pos,
            "is_dead": self.is_dead,
        }


# ============================================================
# 军队类
# ============================================================

class Army:
    """军队"""
    def __init__(self, owner):
        self.owner = owner
        self.units = []
        self.gold = 0
        self.total_spent = 0
    
    def add_unit(self, unit_type):
        """添加单位"""
        template = UNIT_TYPES[unit_type]
        cost = template["cost"]
        
        if self.gold >= cost:
            self.gold -= cost
            self.total_spent += cost
            
            unit = Unit(unit_type, self.owner)
            unit.pos = len(self.units)  # 按添加顺序排列位置
            self.units.append(unit)
            
            return True
        return False
    
    def get_living_units(self):
        """获取存活的单位"""
        return [u for u in self.units if not u.is_dead]
    
    def get_army_stats(self):
        """获取军队统计"""
        living = self.get_living_units()
        total_hp = sum(u.hp for u in living)
        total_max_hp = sum(u.max_hp for u in living)
        
        return {
            "unit_count": len(living),
            "total_hp": total_hp,
            "max_hp": total_max_hp,
            "hp_percent": round(total_hp / total_max_hp * 100, 1) if total_max_hp > 0 else 0,
            "gold_remaining": self.gold,
            "gold_spent": self.total_spent,
        }
    
    def to_dict(self):
        """转换为字典"""
        return {
            "owner": self.owner,
            "units": [u.to_dict() for u in self.units],
            "living_units": [u.to_dict() for u in self.get_living_units()],
            "stats": self.get_army_stats(),
        }


# ============================================================
# 对战引擎
# ============================================================

class BattleEngine:
    """对战引擎"""
    def __init__(self, army1, army2, starting_gold=1000):
        self.army1 = army1
        self.army2 = army2
        self.starting_gold = starting_gold
        self.round = 0
        self.status = "waiting"
        self.logs = []
        self.winner = None
    
    def start(self):
        """开始战斗"""
        self.status = "fighting"
        self.round = 1
        
        # 每回合：每个单位行动一次
        while self.status == "fighting":
            self._round_step()
            
            # 检查是否结束
            army1_alive = len(self.army1.get_living_units())
            army2_alive = len(self.army2.get_living_units())
            
            if army1_alive == 0 or army2_alive == 0:
                self.status = "finished"
                
                if army1_alive > army2_alive:
                    self.winner = self.army1.owner
                elif army2_alive > army1_alive:
                    self.winner = self.army2.owner
                else:
                    # 平局：按剩余血量
                    hp1 = sum(u.hp for u in self.army1.get_living_units())
                    hp2 = sum(u.hp for u in self.army2.get_living_units())
                    self.winner = self.army1.owner if hp1 >= hp2 else self.army2.owner
    
    def _round_step(self):
        """执行一回合"""
        round_log = {
            "round": self.round,
            "actions": []
        }
        
        # 合并所有单位，按速度排序（快的先动）
        all_units = self.army1.get_living_units() + self.army2.get_living_units()
        all_units.sort(key=lambda u: u.speed, reverse=True)
        
        # 每个单位行动
        for unit in all_units:
            if unit.is_dead:
                continue
            
            enemies = self.army2.get_living_units() if unit.owner == self.army1.owner else self.army1.get_living_units()
            
            if not enemies:
                break  # 没有敌人了
            
            action = unit.update(enemies)
            
            if action:
                action["owner"] = unit.owner
                action["unit_icon"] = unit.icon
                action["target_icon"] = enemies[0].icon if enemies else ""
                round_log["actions"].append(action)
        
        self.logs.append(round_log)
        self.round += 1
    
    def get_state(self):
        """获取当前状态"""
        return {
            "round": self.round,
            "status": self.status,
            "winner": self.winner,
            "army1": self.army1.to_dict(),
            "army2": self.army2.to_dict(),
            "army1_stats": self.army1.get_army_stats(),
            "army2_stats": self.army2.get_army_stats(),
        }


# ============================================================
# AI 策略
# ============================================================

def ai_pick_army(starting_gold=1000, enemy_units=None):
    """
    AI 选兵策略
    
    思路：
    1. 分析敌方阵容（如果有）
    2. 计算相克关系
    3. 选择最能克制对方的兵种组合
    """
    army = Army("ai")
    army.gold = starting_gold
    
    if enemy_units:
        # 分析敌方兵种构成
        enemy_types = {}
        for unit in enemy_units:
            unit_type = unit.get("unit_type", "footman")
            enemy_types[unit_type] = enemy_types.get(unit_type, 0) + 1
        
        # 根据敌方阵容选择克制的兵种
        for enemy_type, count in enemy_types.items():
            template = UNIT_TYPES.get(enemy_type, {})
            enemy_armor = template.get("armor_type", "medium")
            enemy_attack = template.get("attack_type", "normal")
            
            # 选择克制这个兵种的单位
            best_counters = self._get_best_counters(enemy_armor, enemy_attack)
            
            for _ in range(count):
                # 尝试购买克制的兵种
                for counter_type in best_counters:
                    if army.gold >= UNIT_TYPES[counter_type]["cost"]:
                        army.add_unit(counter_type)
                        break
    
    # 如果钱还够，买一些通用单位
    while army.gold >= 100:
        # 优先买性价比高的步兵
        if army.gold >= UNIT_TYPES["footman"]["cost"]:
            army.add_unit("footman")
        elif army.gold >= UNIT_TYPES["archer"]["cost"]:
            army.add_unit("archer")
        else:
            break
    
    return army

def self._get_best_counters(enemy_armor, enemy_attack):
    """
    获取克制特定护甲/攻击类型的最优兵种列表
    """
    counters = {
        "none": ["archer", "mage", "footman"],           # 无甲：穿刺/魔法/普通
        "light": ["archer", "mage", "footman"],          # 轻甲：穿刺/魔法/普通
        "medium": ["archer", "mage", "knight"],          # 中甲：穿刺/魔法/重甲
        "heavy": ["mage", "knight", "archer"],           # 重甲：魔法/重甲/穿刺
        "fortified": ["siege_engine", "mage", "knight"], # 城防：攻城/魔法/重甲
    }
    
    return counters.get(enemy_armor, ["footman", "archer", "knight"])


def random_ai(starting_gold=1000):
    """
    随机 AI 策略（新手体验用）
    """
    army = Army("ai")
    army.gold = starting_gold
    
    unit_list = list(UNIT_TYPES.keys())
    
    while army.gold >= 100:
        # 随机选一个能买的兵种
        affordable = [u for u in unit_list if army.gold >= UNIT_TYPES[u]["cost"]]
        if not affordable:
            break
        
        choice = random.choice(affordable)
        army.add_unit(choice)
    
    return army


def balanced_ai(starting_gold=1000):
    """
    均衡 AI 策略
    """
    army = Army("ai")
    army.gold = starting_gold
    
    # 标准配置：2步兵 + 2弓箭手 + 1骑士 + 1投石车 + 1法师
    composition = ["footman", "footman", "archer", "archer", "knight", "siege_engine", "mage"]
    
    for unit_type in composition:
        if army.gold >= UNIT_TYPES[unit_type]["cost"]:
            army.add_unit(unit_type)
    
    return army
