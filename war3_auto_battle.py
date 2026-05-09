#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
魔兽争霸风格兵种对战 - 自动对战脚本
自动完成房间创建、两个AI选兵、对战执行、结果展示
"""

import sys
import os
import time
import random
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socketserver
import threading
import urllib.request
import urllib.parse

# 导入兵种系统
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from war3_units import (
    UNIT_TYPES, DAMAGE_MULTIPLIERS, get_damage_multiplier,
    Unit, Army, BattleEngine,
    ai_pick_army, random_ai, balanced_ai
)

# ============================================================
# 全局配置
# ============================================================

SERVER_PORT = 18800
GOLD_PER_PLAYER = 1500  # 每位玩家初始金币

# ============================================================
# AI 策略定义
# ============================================================

def smart_ai(starting_gold, enemy_units=None):
    """
    智能 AI - 根据敌方阵容选择克制的兵种
    
    策略：
    1. 分析敌方兵种构成
    2. 计算最佳克制组合
    3. 优先选择高性价比兵种
    """
    army = Army("ai_smart")
    army.gold = starting_gold
    
    if enemy_units:
        # 统计敌方护甲类型
        armor_count = {}
        for unit in enemy_units:
            armor = unit.get("armor_type", "medium")
            armor_count[armor] = armor_count.get(armor, 0) + 1
        
        # 根据敌方护甲类型分配克制兵种
        for armor_type, count in armor_count.items():
            # 找克制这个护甲的攻击类型
            best_attack = "normal"
            if armor_type == "light":
                best_attack = "pierce"  # 穿刺克轻甲
            elif armor_type == "medium":
                best_attack = "magic"   # 魔法克中甲
            elif armor_type == "heavy":
                best_attack = "magic"   # 魔法克重甲
            elif armor_type == "fortified":
                best_attack = "siege"  # 攻城克城防
            
            # 找使用这种攻击的兵种
            for unit_type, template in UNIT_TYPES.items():
                if template["attack_type"] == best_attack:
                    for _ in range(min(count, 3)):
                        if army.gold >= template["cost"]:
                            army.add_unit(unit_type)
    
    # 补充均衡阵容
    composition_order = ["knight", "footman", "archer", "mage", "siege_engine"]
    for unit_type in composition_order:
        template = UNIT_TYPES[unit_type]
        while army.gold >= template["cost"] and len(army.units) < 8:
            army.add_unit(unit_type)
    
    return army


def aggressive_ai(starting_gold):
    """
    激进 AI - 全买骑士（重甲），配合投石车
    
    策略：高血量硬推，不考虑相克
    """
    army = Army("ai_aggressive")
    army.gold = starting_gold
    
    # 先买骑士
    while army.gold >= UNIT_TYPES["knight"]["cost"]:
        army.add_unit("knight")
    
    # 剩余买投石车
    while army.gold >= UNIT_TYPES["siege_engine"]["cost"]:
        army.add_unit("siege_engine")
    
    # 剩余买步兵
    while army.gold >= UNIT_TYPES["footman"]["cost"]:
        army.add_unit("footman")
    
    return army


def defensive_ai(starting_gold):
    """
    防守 AI - 大量弓箭手 + 法师
    
    策略：远程输出，利用射程优势
    """
    army = Army("ai_defensive")
    army.gold = starting_gold
    
    # 先买弓箭手
    while army.gold >= UNIT_TYPES["archer"]["cost"]:
        army.add_unit("archer")
    
    # 剩余买法师
    while army.gold >= UNIT_TYPES["mage"]["cost"]:
        army.add_unit("mage")
    
    # 剩余买步兵（肉盾）
    while army.gold >= UNIT_TYPES["footman"]["cost"]:
        army.add_unit("footman")
    
    return army


def counter_pick_ai(starting_gold, enemy_units=None):
    """
    反选 AI - 完全针对敌方阵容
    
    策略：
    - 无甲多 → 穿刺（弓箭手）
    - 轻甲多 → 穿刺+魔法（弓箭手+法师）
    - 中甲多 → 魔法（法师）
    - 重甲多 → 魔法（法师）
    - 城防多 → 攻城（投石车）
    """
    army = Army("ai_counter")
    army.gold = starting_gold
    
    if not enemy_units:
        return balanced_ai(starting_gold)
    
    # 统计敌方护甲分布
    armor_distribution = {}
    for unit in enemy_units:
        armor = unit.get("armor_type", "medium")
        armor_distribution[armor] = armor_distribution.get(armor, 0) + 1
    
    # 分配克制兵种
    counter_mapping = {
        "none": ("archer", 1.5),
        "light": ("archer", 1.5),
        "medium": ("mage", 1.5),
        "heavy": ("mage", 1.2),
        "fortified": ("siege_engine", 2.0),
    }
    
    total_units = len(enemy_units)
    for armor, count in armor_distribution.items():
        counter_type, _ = counter_mapping.get(armor, ("footman", 1.0))
        # 按比例分配
        num_to_buy = int(count * 1.5) + 1
        
        for _ in range(min(num_to_buy, 5)):
            if army.gold >= UNIT_TYPES[counter_type]["cost"]:
                army.add_unit(counter_type)
    
    # 补充一些通用单位
    while army.gold >= UNIT_TYPES["footman"]["cost"] and len(army.units) < total_units:
        army.add_unit("footman")
    
    return army


# ============================================================
# 对战执行
# ============================================================

def run_battle(ai1_factory, ai2_factory, verbose=True):
    """
    运行一场对战
    
    ai1_factory: AI1 工厂函数
    ai2_factory: AI2 工厂函数
    """
    if verbose:
        print("\n" + "=" * 60)
        print("⚔️  魔兽争霸风格兵种对战")
        print("=" * 60)
    
    # 创建军队
    army1 = ai1_factory(GOLD_PER_PLAYER)
    army2 = ai2_factory(GOLD_PER_PLAYER)
    
    # AI2 知道 AI1 的阵容，进行反选
    army2 = counter_pick_ai(GOLD_PER_PLAYER, army1.units)
    
    if verbose:
        print(f"\n📊 初始状态（每位玩家 {GOLD_PER_PLAYER} 金币）")
        print(f"\n🔵 玩家1 阵容（{army1.get_army_stats()['unit_count']} 个单位）：")
        _print_army(army1)
        
        print(f"\n🔴 玩家2 阵容（{army2.get_army_stats()['unit_count']} 个单位）：")
        _print_army(army2)
    
    # 创建对战引擎
    engine = BattleEngine(army1, army2, GOLD_PER_PLAYER)
    
    # 开始战斗
    if verbose:
        print("\n⚔️  开始战斗！")
        print("-" * 60)
    
    engine.start()
    
    # 显示结果
    if verbose:
        _print_battle_result(engine)
    
    return engine


def _print_army(army):
    """打印军队阵容"""
    stats = army.get_army_stats()
    print(f"   💰 花费 {stats['gold_spent']} 金币，剩余 {stats['gold_remaining']} 金币")
    
    # 按兵种分组
    unit_groups = {}
    for unit in army.units:
        name = f"{unit.icon} {unit.name}"
        unit_groups[name] = unit_groups.get(name, 0) + 1
    
    for name, count in unit_groups.items():
        print(f"   - {name} × {count}")


def _print_battle_result(engine):
    """打印战斗结果"""
    print("\n" + "=" * 60)
    print("🏆 战斗结束！")
    print("=" * 60)
    
    print(f"\n📊 对战回合数：{engine.round - 1}")
    
    print(f"\n🔵 玩家1 剩余：")
    for unit in engine.army1.get_living_units():
        print(f"   {unit.icon} {unit.name} - HP {unit.hp}/{unit.max_hp} ({unit.hp/unit.max_hp*100:.1f}%)")
    
    print(f"\n🔴 玩家2 剩余：")
    for unit in engine.army2.get_living_units():
        print(f"   {unit.icon} {unit.name} - HP {unit.hp}/{unit.max_hp} ({unit.hp/unit.max_hp*100:.1f}%)")
    
    print(f"\n🏆 获胜者：{engine.winner}")
    
    # 计算最终得分
    hp1 = sum(u.hp for u in engine.army1.get_living_units())
    hp2 = sum(u.hp for u in engine.army2.get_living_units())
    
    print(f"\n📈 战力对比：")
    print(f"   🔵 玩家1 总剩余 HP：{hp1}")
    print(f"   🔴 玩家2 总剩余 HP：{hp2}")


# ============================================================
# 演示模式
# ============================================================

def demo_mode():
    """演示模式 - 多场对战"""
    print("\n" + "🎮 " * 20)
    print("🎮  魔兽争霸风格兵种对战 - 演示模式")
    print("🎮 " * 20)
    
    ai_strategies = [
        ("智能 AI", smart_ai),
        ("激进 AI (全骑士)", aggressive_ai),
        ("防守 AI (远程流)", defensive_ai),
        ("反选 AI", counter_pick_ai),
    ]
    
    # 第一场：智能 vs 激进
    print("\n\n" + "🔵 第一场：智能 AI vs 激进 AI" + " 🔴")
    run_battle(smart_ai, aggressive_ai)
    
    print("\n\n" + "🔵 第二场：防守 AI vs 反选 AI" + " 🔴")
    run_battle(defensive_ai, counter_pick_ai)
    
    print("\n\n" + "🔵 第三场：智能 AI vs 反选 AI" + " 🔴")
    run_battle(smart_ai, counter_pick_ai)
    
    print("\n\n" + "🎮 " * 20)
    print("🎮  演示结束！")
    print("🎮 " * 20)


# ============================================================
# 单挑模式
# ============================================================

def duel_mode():
    """单挑模式 - 用户选择对阵 AI"""
    print("\n" + "🎯 " * 20)
    print("🎯  魔兽争霸风格兵种对战 - 单挑模式")
    print("🎯 " * 20)
    
    ai_strategies = [
        ("智能 AI", smart_ai),
        ("激进 AI (全骑士)", aggressive_ai),
        ("防守 AI (远程流)", defensive_ai),
        ("反选 AI", counter_pick_ai),
    ]
    
    print("\n请选择你的策略：")
    for i, (name, _) in enumerate(ai_strategies, 1):
        print(f"  {i}. {name}")
    print(f"  5. 随机")
    
    choice = input("\n你的选择 (1-5): ").strip()
    
    if choice == "5":
        choice = str(random.randint(1, 4))
    
    try:
        player_idx = int(choice) - 1
        if 0 <= player_idx < len(ai_strategies):
            player_name, player_ai = ai_strategies[player_idx]
        else:
            player_name, player_ai = "玩家", smart_ai
    except:
        player_name, player_ai = "玩家", smart_ai
    
    # 对手随机
    enemy_name, enemy_ai = random.choice(ai_strategies)
    
    print(f"\n🔵 你的策略：{player_name}")
    print(f"🔴 对手策略：{enemy_name}")
    
    print("\n" + "-" * 60)
    run_battle(player_ai, enemy_ai)


# ============================================================
# 锦标赛模式
# ============================================================

def tournament_mode():
    """锦标赛模式 - 所有 AI 大乱斗"""
    print("\n" + "🏆 " * 20)
    print("🏆  魔兽争霸风格兵种对战 - 锦标赛模式")
    print("🏆 " * 20)
    
    ai_strategies = [
        ("智能 AI", smart_ai),
        ("激进 AI", aggressive_ai),
        ("防守 AI", defensive_ai),
        ("反选 AI", counter_pick_ai),
        ("随机 AI", random_ai),
        ("均衡 AI", balanced_ai),
    ]
    
    # 战绩统计
    wins = {name: 0 for name, _ in ai_strategies}
    total_hp = {name: 0 for name, _ in ai_strategies}
    
    # 循环对战
    for i, (name1, ai1) in enumerate(ai_strategies):
        for j, (name2, ai2) in enumerate(ai_strategies):
            if i >= j:
                continue
            
            print(f"\n📊 {name1} vs {name2}")
            
            # 双向对战（主客场）
            for _ in range(2):
                if _ == 0:
                    engine = run_battle(ai1, ai2, verbose=False)
                else:
                    engine = run_battle(ai2, ai1, verbose=False)
                
                # 记录战绩
                if engine.winner:
                    if "ai_smart" in engine.winner or "smart" in engine.army1.owner:
                        if engine.army1.owner in engine.winner or engine.army1.get_living_units():
                            wins[name1] += 1
                            total_hp[name1] += sum(u.hp for u in engine.army1.get_living_units())
                            total_hp[name2] += sum(u.hp for u in engine.army2.get_living_units())
                        else:
                            wins[name2] += 1
                            total_hp[name2] += sum(u.hp for u in engine.army2.get_living_units())
                            total_hp[name1] += sum(u.hp for u in engine.army1.get_living_units())
    
    # 排行榜
    print("\n" + "🏆 " * 20)
    print("🏆  最终排行榜")
    print("🏆 " * 20)
    
    sorted_ai = sorted(wins.items(), key=lambda x: x[1], reverse=True)
    
    for i, (name, win_count) in enumerate(sorted_ai, 1):
        print(f"  {i}. {name}: {win_count} 胜")


# ============================================================
# 主入口
# ============================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="魔兽争霸风格兵种对战")
    parser.add_argument("--mode", "-m", choices=["demo", "duel", "tournament", "1v1"],
                       default="demo", help="运行模式")
    parser.add_argument("--ai1", help="AI1 策略 (smart/aggressive/defensive/counter)")
    parser.add_argument("--ai2", help="AI2 策略")
    parser.add_argument("--gold", type=int, default=GOLD_PER_PLAYER, help="初始金币")
    
    args = parser.parse_args()
    
    # 更新全局配置
    GOLD_PER_PLAYER = args.gold
    
    if args.mode == "demo":
        demo_mode()
    elif args.mode == "duel":
        duel_mode()
    elif args.mode == "tournament":
        tournament_mode()
    elif args.mode == "1v1":
        # 指定 AI 对战
        ai_mapping = {
            "smart": smart_ai,
            "aggressive": aggressive_ai,
            "defensive": defensive_ai,
            "counter": counter_pick_ai,
            "random": random_ai,
            "balanced": balanced_ai,
        }
        
        ai1 = ai_mapping.get(args.ai1, smart_ai)
        ai2 = ai_mapping.get(args.ai2, counter_pick_ai)
        
        ai1_name = args.ai1 or "智能 AI"
        ai2_name = args.ai2 or "反选 AI"
        
        print(f"\n🔵 AI1: {ai1_name}")
        print(f"🔴 AI2: {ai2_name}")
        
        run_battle(ai1, ai2)
