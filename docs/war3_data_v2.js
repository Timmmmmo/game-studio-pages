// ==================== 魔兽兵种对战增强版 ====================
// 包含：技能系统、动画效果、资源管理、科技升级

const VERSION = "2.0.0";

// ==================== 攻击/护甲类型 ====================
const ARMOR_TYPES = {
  none: { name: "无甲", color: "#95a5a6", desc: "无任何防护，脆弱但灵活" },
  light: { name: "轻甲", color: "#3498db", desc: "轻便护甲，对穿刺敏感" },
  medium: { name: "中甲", color: "#27ae60", desc: "标准护甲，对魔法敏感" },
  heavy: { name: "重甲", color: "#e74c3c", desc: "厚重铠甲，对魔法脆弱" },
  fortified: { name: "城防", color: "#9b59b6", desc: "坚固城防，对攻城敏感" },
  hero: { name: "英雄", color: "#f39c12", desc: "英雄护甲，全能型" }
};

const ATTACK_TYPES = {
  normal: { name: "普通", color: "#ecf0f1", desc: "近战物理攻击" },
  pierce: { name: "穿刺", color: "#2ecc71", desc: "远程穿透攻击" },
  magic: { name: "魔法", color: "#9b59b6", desc: "魔法能量攻击" },
  siege: { name: "攻城", color: "#e67e22", desc: "重型攻城武器" },
  hero: { name: "英雄", color: "#f39c12", desc: "英雄专属攻击" }
};

// 伤害倍率表
const DAMAGE_TABLE = {
  normal: { none: 1.0, light: 1.5, medium: 1.5, heavy: 1.0, fortified: 0.5, hero: 1.0 },
  pierce: { none: 1.5, light: 1.5, medium: 0.7, heavy: 0.7, fortified: 0.3, hero: 0.5 },
  magic:  { none: 1.0, light: 1.5, medium: 1.5, heavy: 1.2, fortified: 0.5, hero: 0.5 },
  siege:  { none: 0.5, light: 0.5, medium: 1.5, heavy: 1.5, fortified: 2.0, hero: 0.3 },
  hero:   { none: 1.0, light: 1.0, medium: 1.0, heavy: 1.0, fortified: 0.5, hero: 1.0 }
};

// ==================== 技能系统 ====================
const SKILLS = {
  // 被动技能
  critical_strike: {
    name: "致命一击",
    type: "passive",
    desc: "攻击有20%概率造成2倍伤害",
    icon: "⚡",
    effect: (unit, target, baseDmg) => {
      if (Math.random() < 0.2) {
        return { damage: baseDmg * 2, crit: true };
      }
      return { damage: baseDmg, crit: false };
    }
  },

  evasion: {
    name: "闪避",
    type: "passive",
    desc: "有15%概率躲避攻击",
    icon: "💨",
    effect: (unit) => Math.random() < 0.15
  },

  armor_aura: {
    name: "护甲光环",
    type: "aura",
    desc: "周围友军护甲+3",
    icon: "🛡️",
    radius: 2,
    effect: (allies) => allies.forEach(u => u.tempArmor = (u.tempArmor || 0) + 3)
  },

  vampiric: {
    name: "吸血",
    type: "passive",
    desc: "攻击回复造成伤害的25%生命",
    icon: "🩸",
    effect: (unit, damage) => {
      const heal = Math.floor(damage * 0.25);
      unit.hp = Math.min(unit.max_hp, unit.hp + heal);
      return { healed: heal };
    }
  },

  // 主动技能
  thunder_clap: {
    name: "雷霆一击",
    type: "active",
    desc: "对周围敌人造成50伤害并减速",
    icon: "⛈️",
    cooldown: 3,
    manaCost: 50,
    effect: (unit, enemies) => {
      const targets = enemies.filter(e => !e.dead && Math.abs(e.pos - unit.pos) <= 2);
      targets.forEach(t => {
        t.hp -= 50;
        t.slowed = 2; // 减速2回合
      });
      return { targets: targets.length, damage: 50 };
    }
  },

  healing_wave: {
    name: "治疗波",
    type: "active",
    desc: "治疗3个友军单位，每次弹跳治疗效果降低25%",
    icon: "💚",
    cooldown: 4,
    manaCost: 80,
    effect: (unit, allies) => {
      const targets = allies.filter(a => !a.dead && a.hp < a.max_hp).slice(0, 3);
      let healAmount = 100;
      targets.forEach((t, i) => {
        const actualHeal = Math.floor(healAmount * Math.pow(0.75, i));
        t.hp = Math.min(t.max_hp, t.hp + actualHeal);
      });
      return { targets: targets.length, heal: 100 };
    }
  },

  chain_lightning: {
    name: "闪电链",
    type: "active",
    desc: "对最多5个敌人造成递减伤害",
    icon: "⚡",
    cooldown: 3,
    manaCost: 60,
    effect: (unit, enemies) => {
      const targets = enemies.filter(e => !e.dead).slice(0, 5);
      let dmg = 80;
      targets.forEach((t, i) => {
        const actualDmg = Math.floor(dmg * Math.pow(0.8, i));
        t.hp -= actualDmg;
      });
      return { targets: targets.length, damage: 80 };
    }
  },

  blizzard: {
    name: "暴风雪",
    type: "active",
    desc: "对所有敌人造成持续伤害",
    icon: "❄️",
    cooldown: 5,
    manaCost: 100,
    duration: 3,
    effect: (unit, enemies) => {
      enemies.filter(e => !e.dead).forEach(e => {
        e.hp -= 30;
      });
      return { targets: enemies.filter(e => !e.dead).length, damage: 30 };
    }
  },

  reincarnation: {
    name: "重生",
    type: "passive",
    desc: "死亡时有一定概率复活，回复50%生命",
    icon: "🔄",
    cooldown: 10,
    effect: (unit) => {
      if (unit.dead && Math.random() < 0.3) {
        unit.dead = false;
        unit.hp = Math.floor(unit.max_hp * 0.5);
        return { revived: true };
      }
      return { revived: false };
    }
  }
};

// ==================== 科技系统 ====================
const TECHS = {
  // 经济科技
  gold_mining: {
    name: "金矿开采",
    tier: 1,
    cost: 200,
    effect: "每回合额外获得50金币",
    type: "economy"
  },

  lumber_harvest: {
    name: "木材采集",
    tier: 1,
    cost: 200,
    effect: "解锁高级建筑",
    type: "economy"
  },

  // 军事科技
  melee_weapons: {
    name: "近战武器",
    tier: 1,
    cost: 150,
    effect: "近战单位攻击+5",
    type: "military"
  },

  ranged_weapons: {
    name: "远程武器",
    tier: 1,
    cost: 150,
    effect: "远程单位攻击+3",
    type: "military"
  },

  armor_plating: {
    name: "装甲强化",
    tier: 1,
    cost: 200,
    effect: "所有单位护甲+2",
    type: "military"
  },

  // 高级科技
  magic_amplification: {
    name: "魔法增幅",
    tier: 2,
    cost: 300,
    requires: ["lumber_harvest"],
    effect: "魔法单位攻击+10",
    type: "military"
  },

  siege_tactics: {
    name: "攻城战术",
    tier: 2,
    cost: 350,
    requires: ["melee_weapons"],
    effect: "攻城单位攻击+15",
    type: "military"
  },

  hero_training: {
    name: "英雄训练",
    tier: 3,
    cost: 500,
    requires: ["melee_weapons", "armor_plating"],
    effect: "解锁英雄单位",
    type: "military"
  }
};

// ==================== 增强版兵种定义 ====================
const UNITS_V2 = {
  // === 基础兵种 ===
  footman: {
    name: "步兵",
    icon: "⚔️",
    cost: 100,
    goldCost: 100,
    lumberCost: 0,
    hp: 500,
    damage: 25,
    attackType: "normal",
    armorType: "medium",
    armor: 5,
    speed: 280,
    range: "melee",
    mana: 0,
    maxMana: 0,
    skills: [],
    tier: 1,
    desc: "基础近战单位，性价比高"
  },

  archer: {
    name: "弓箭手",
    icon: "🏹",
    cost: 120,
    goldCost: 120,
    lumberCost: 0,
    hp: 300,
    damage: 20,
    attackType: "pierce",
    armorType: "light",
    armor: 0,
    speed: 320,
    range: "ranged",
    mana: 0,
    maxMana: 0,
    skills: [],
    tier: 1,
    desc: "远程穿刺单位，克制轻甲"
  },

  mage: {
    name: "法师",
    icon: "🔮",
    cost: 150,
    goldCost: 130,
    lumberCost: 20,
    hp: 280,
    damage: 35,
    attackType: "magic",
    armorType: "none",
    armor: 0,
    speed: 300,
    range: "ranged",
    mana: 100,
    maxMana: 100,
    skills: ["chain_lightning"],
    tier: 2,
    desc: "魔法单位，克制重甲和中甲"
  },

  knight: {
    name: "骑士",
    icon: "🛡️",
    cost: 200,
    goldCost: 180,
    lumberCost: 20,
    hp: 900,
    damage: 40,
    attackType: "normal",
    armorType: "heavy",
    armor: 10,
    speed: 250,
    range: "melee",
    mana: 0,
    maxMana: 0,
    skills: [],
    tier: 2,
    desc: "重甲坦克，血量高"
  },

  siege_engine: {
    name: "投石车",
    icon: "💥",
    cost: 180,
    goldCost: 150,
    lumberCost: 30,
    hp: 400,
    damage: 70,
    attackType: "siege",
    armorType: "fortified",
    armor: 8,
    speed: 200,
    range: "ranged",
    mana: 0,
    maxMana: 0,
    skills: [],
    tier: 2,
    desc: "攻城单位，克制城防"
  },

  // === 进阶兵种 ===
  rifleman: {
    name: "火枪手",
    icon: "🔫",
    cost: 140,
    goldCost: 120,
    lumberCost: 20,
    hp: 350,
    damage: 30,
    attackType: "pierce",
    armorType: "medium",
    armor: 3,
    speed: 300,
    range: "ranged",
    mana: 0,
    maxMana: 0,
    skills: [],
    tier: 1,
    desc: "中甲穿刺单位，生存能力强于弓箭手"
  },

  priest: {
    name: "牧师",
    icon: "✝️",
    cost: 160,
    goldCost: 140,
    lumberCost: 20,
    hp: 320,
    damage: 15,
    attackType: "magic",
    armorType: "light",
    armor: 1,
    speed: 280,
    range: "ranged",
    mana: 150,
    maxMana: 150,
    skills: ["healing_wave"],
    tier: 2,
    desc: "治疗单位，可回复友军生命"
  },

  tauren: {
    name: "牛头人",
    icon: "🐂",
    cost: 220,
    goldCost: 200,
    lumberCost: 20,
    hp: 800,
    damage: 30,
    attackType: "normal",
    armorType: "heavy",
    armor: 8,
    speed: 240,
    range: "melee",
    mana: 0,
    maxMana: 0,
    skills: ["critical_strike"],
    tier: 2,
    desc: "重型近战，有暴击能力"
  },

  // === 特殊兵种 ===
  blademaster: {
    name: "剑圣",
    icon: "🗡️",
    cost: 280,
    goldCost: 250,
    lumberCost: 30,
    hp: 600,
    damage: 50,
    attackType: "normal",
    armorType: "light",
    armor: 4,
    speed: 350,
    range: "melee",
    mana: 100,
    maxMana: 100,
    skills: ["critical_strike", "evasion"],
    tier: 3,
    requires: ["hero_training"],
    desc: "敏捷型英雄，高暴击和闪避"
  },

  mountain_king: {
    name: "山丘之王",
    icon: "🏔️",
    cost: 320,
    goldCost: 280,
    lumberCost: 40,
    hp: 1000,
    damage: 45,
    attackType: "normal",
    armorType: "heavy",
    armor: 12,
    speed: 220,
    range: "melee",
    mana: 150,
    maxMana: 150,
    skills: ["thunder_clap"],
    tier: 3,
    requires: ["hero_training"],
    desc: "力量型英雄，有范围控制技能"
  },

  archmage: {
    name: "大法师",
    icon: "🧙",
    cost: 300,
    goldCost: 260,
    lumberCost: 40,
    hp: 400,
    damage: 40,
    attackType: "magic",
    armorType: "none",
    armor: 2,
    speed: 280,
    range: "ranged",
    mana: 200,
    maxMana: 200,
    skills: ["blizzard", "chain_lightning"],
    tier: 3,
    requires: ["hero_training", "magic_amplification"],
    desc: "智力型英雄，强大的AOE魔法"
  },

  dreadlord: {
    name: "恐惧魔王",
    icon: "🦇",
    cost: 350,
    goldCost: 300,
    lumberCost: 50,
    hp: 700,
    damage: 35,
    attackType: "normal",
    armorType: "heavy",
    armor: 6,
    speed: 300,
    range: "melee",
    mana: 180,
    maxMana: 180,
    skills: ["vampiric", "reincarnation"],
    tier: 3,
    requires: ["hero_training"],
    desc: "吸血英雄，有重生能力"
  }
};

// ==================== 单位类（增强版） ====================
class UnitV2 {
  constructor(type, owner, idx) {
    const t = UNITS_V2[type];
    if (!t) throw new Error(`Unknown unit type: ${type}`);

    Object.assign(this, t);
    this.type = type;
    this.owner = owner;
    this.idx = idx;
    this.max_hp = t.hp;
    this.hp = t.hp;
    this.dead = false;
    this.skillCooldowns = {};
    this.slowed = 0;
    this.tempArmor = 0;

    // 初始化技能冷却
    t.skills.forEach(s => {
      this.skillCooldowns[s] = 0;
    });
  }

  get effectiveArmor() {
    return this.armor + (this.tempArmor || 0);
  }

  get effectiveSpeed() {
    return this.slowed > 0 ? Math.floor(this.speed * 0.5) : this.speed;
  }

  findTarget(enemies) {
    let best = null, bestScore = -Infinity;

    for (const e of enemies) {
      if (e.dead) continue;

      const m = DAMAGE_TABLE[this.attackType]?.[e.armorType] ?? 1.0;
      const vulnScore = (m - 1) * 100;
      const hpScore = (1 - e.hp / e.max_hp) * 30;
      const speedBonus = e.speed > this.speed ? 10 : 0;
      const score = vulnScore + hpScore + speedBonus - e.idx * 2;

      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }

    return best;
  }

  // 执行回合行动
  act(enemies, allies, techs) {
    if (this.dead) return null;

    // 减少减速效果
    if (this.slowed > 0) this.slowed--;

    // 减少技能冷却
    Object.keys(this.skillCooldowns).forEach(s => {
      if (this.skillCooldowns[s] > 0) this.skillCooldowns[s]--;
    });

    const actions = [];

    // 1. 检查主动技能
    if (this.skills.length > 0 && this.mana > 0) {
      for (const skillId of this.skills) {
        const skill = SKILLS[skillId];
        if (skill && skill.type === "active" && this.skillCooldowns[skillId] === 0) {
          if (this.mana >= skill.manaCost) {
            this.mana -= skill.manaCost;
            this.skillCooldowns[skillId] = skill.cooldown;
            const result = skill.effect(this, this.owner === "blue" ? enemies : allies);
            actions.push({
              type: "skill",
              skillId,
              skillName: skill.name,
              icon: skill.icon,
              unit: this,
              result
            });
            break; // 每回合只使用一个技能
          }
        }
      }
    }

    // 2. 普通攻击
    const target = this.findTarget(enemies);
    if (!target) return actions.length > 0 ? actions : null;

    let baseDmg = this.damage;

    // 应用科技加成
    if (techs && techs.length > 0) {
      if (techs.includes("melee_weapons") && this.range === "melee") baseDmg += 5;
      if (techs.includes("ranged_weapons") && this.range === "ranged") baseDmg += 3;
      if (techs.includes("magic_amplification") && this.attackType === "magic") baseDmg += 10;
      if (techs.includes("siege_tactics") && this.attackType === "siege") baseDmg += 15;
    }

    // 计算伤害
    const mult = DAMAGE_TABLE[this.attackType]?.[target.armorType] ?? 1.0;
    let dmg = Math.max(1, Math.round(baseDmg * mult - target.effectiveArmor));

    // 检查技能效果
    let crit = false;
    let healed = 0;

    // 检查致命一击
    if (this.skills.includes("critical_strike")) {
      const skill = SKILLS.critical_strike;
      const result = skill.effect(this, target, dmg);
      if (result.crit) {
        dmg = result.damage;
        crit = true;
      }
    }

    // 检查目标闪避
    if (target.skills && target.skills.includes("evasion")) {
      if (SKILLS.evasion.effect(target)) {
        actions.push({
          type: "attack",
          unit: this,
          target,
          damage: 0,
          evaded: true
        });
        return actions;
      }
    }

    // 造成伤害
    target.hp -= dmg;
    const killed = target.hp <= 0;
    if (killed) {
      target.dead = true;
      target.hp = 0;

      // 检查重生
      if (target.skills && target.skills.includes("reincarnation")) {
        const result = SKILLS.reincarnation(target);
        if (result.revived) {
          actions.push({
            type: "revive",
            unit: target
          });
        }
      }
    }

    // 检查吸血
    if (this.skills.includes("vampiric")) {
      const result = SKILLS.vampiric.effect(this, dmg);
      healed = result.healed;
    }

    actions.push({
      type: "attack",
      unit: this,
      target,
      damage: dmg,
      crit,
      killed,
      healed
    });

    return actions;
  }
}

// ==================== 资源管理系统 ====================
class ResourceManager {
  constructor(startingGold = 1500, startingLumber = 0) {
    this.gold = startingGold;
    this.lumber = startingLumber;
    this.goldPerTurn = 50;
    this.lumberPerTurn = 0;
    this.techs = [];
  }

  canAfford(unitType) {
    const u = UNITS_V2[unitType];
    if (!u) return false;
    return this.gold >= u.goldCost && this.lumber >= u.lumberCost;
  }

  purchase(unitType) {
    const u = UNITS_V2[unitType];
    if (!u || !this.canAfford(unitType)) return false;

    // 检查科技需求
    if (u.requires) {
      for (const req of u.requires) {
        if (!this.techs.includes(req)) return false;
      }
    }

    this.gold -= u.goldCost;
    this.lumber -= u.lumberCost;
    return true;
  }

  canResearchTech(techId) {
    const tech = TECHS[techId];
    if (!tech) return false;
    if (this.techs.includes(techId)) return false;
    if (this.gold < tech.cost) return false;

    // 检查前置科技
    if (tech.requires) {
      for (const req of tech.requires) {
        if (!this.techs.includes(req)) return false;
      }
    }

    return true;
  }

  researchTech(techId) {
    if (!this.canResearchTech(techId)) return false;

    const tech = TECHS[techId];
    this.gold -= tech.cost;
    this.techs.push(techId);

    // 应用科技效果
    if (techId === "gold_mining") this.goldPerTurn += 50;
    if (techId === "lumber_harvest") this.lumberPerTurn += 20;

    return true;
  }

  endTurn() {
    this.gold += this.goldPerTurn;
    this.lumber += this.lumberPerTurn;
  }

  getState() {
    return {
      gold: this.gold,
      lumber: this.lumber,
      goldPerTurn: this.goldPerTurn,
      lumberPerTurn: this.lumberPerTurn,
      techs: this.techs
    };
  }
}

// ==================== AI策略（增强版） ====================
class AIBrainV2 {
  constructor(name, personality = "balanced") {
    this.name = name;
    this.personality = personality; // aggressive, defensive, balanced, economic
    this.resources = new ResourceManager(1500, 50);
    this.army = [];
    this.strategyPhase = "early"; // early, mid, late
    this.turnCount = 0;
  }

  // 分析敌方阵容
  analyzeEnemy(enemyArmy) {
    const analysis = {
      totalHP: 0,
      totalDamage: 0,
      armorDistribution: {},
      attackDistribution: {},
      hasHeroes: false,
      hasHealer: false,
      hasAOE: false
    };

    enemyArmy.forEach(u => {
      analysis.totalHP += u.hp;
      analysis.totalDamage += u.damage;
      analysis.armorDistribution[u.armorType] = (analysis.armorDistribution[u.armorType] || 0) + 1;
      analysis.attackDistribution[u.attackType] = (analysis.attackDistribution[u.attackType] || 0) + 1;

      if (u.tier === 3) analysis.hasHeroes = true;
      if (u.skills.includes("healing_wave")) analysis.hasHealer = true;
      if (u.skills.includes("blizzard") || u.skills.includes("thunder_clap")) analysis.hasAOE = true;
    });

    return analysis;
  }

  // 决定科技升级
  decideTech(enemyAnalysis) {
    const availableTechs = Object.keys(TECHS).filter(t => this.resources.canResearchTech(t));

    if (availableTechs.length === 0) return null;

    // 根据策略和敌人情况选择科技
    switch (this.personality) {
      case "aggressive":
        // 激进策略：优先军事科技
        const militaryTechs = availableTechs.filter(t => TECHS[t].type === "military");
        if (militaryTechs.length > 0) {
          // 敌人重甲多 → 魔法增幅
          if (enemyAnalysis && enemyAnalysis.armorDistribution.heavy > 2) {
            return militaryTechs.find(t => t === "magic_amplification") || militaryTechs[0];
          }
          return militaryTechs[0];
        }
        break;

      case "defensive":
        // 防守策略：优先护甲
        if (availableTechs.includes("armor_plating")) return "armor_plating";
        break;

      case "economic":
        // 经济策略：优先经济科技
        if (availableTechs.includes("gold_mining")) return "gold_mining";
        if (availableTechs.includes("lumber_harvest")) return "lumber_harvest";
        break;

      case "balanced":
      default:
        // 均衡策略：根据敌人调整
        if (enemyAnalysis) {
          // 敌人魔法多 → 护甲
          if (enemyAnalysis.attackDistribution.magic > 2) {
            if (availableTechs.includes("armor_plating")) return "armor_plating";
          }
          // 敌人穿刺多 → 护甲
          if (enemyAnalysis.attackDistribution.pierce > 2) {
            if (availableTechs.includes("armor_plating")) return "armor_plating";
          }
        }
        // 默认优先经济
        if (availableTechs.includes("gold_mining")) return "gold_mining";
        break;
    }

    return availableTechs[0];
  }

  // 决定生产单位
  decideProduction(enemyArmy) {
    const analysis = enemyArmy ? this.analyzeEnemy(enemyArmy) : null;
    const choices = [];
    const state = this.resources.getState();

    // 确定可生产的单位
    const availableUnits = Object.keys(UNITS_V2).filter(u => {
      const unit = UNITS_V2[u];
      if (!this.resources.canAfford(u)) return false;
      if (unit.requires) {
        for (const req of unit.requires) {
          if (!state.techs.includes(req)) return false;
        }
      }
      return true;
    });

    if (availableUnits.length === 0) return choices;

    // 根据策略选择单位
    const targetArmySize = this.strategyPhase === "early" ? 5 : this.strategyPhase === "mid" ? 8 : 10;

    while (this.army.length + choices.length < targetArmySize) {
      let bestChoice = null;
      let bestScore = -Infinity;

      for (const unitType of availableUnits) {
        const unit = UNITS_V2[unitType];
        if (!this.resources.canAfford(unitType)) continue;

        let score = 0;

        // 基础评分：性价比
        score += unit.damage / unit.cost * 100;
        score += unit.hp / unit.cost * 50;

        // 根据敌人调整评分
        if (analysis) {
          // 针对敌方护甲
          const counterMult = DAMAGE_TABLE[unit.attackType]?.[Object.keys(analysis.armorDistribution).sort((a, b) =>
            analysis.armorDistribution[b] - analysis.armorDistribution[a])[0]] ?? 1;
          score += counterMult * 30;

          // 针对敌方攻击类型
          const mainEnemyAttack = Object.keys(analysis.attackDistribution).sort((a, b) =>
            analysis.attackDistribution[b] - analysis.attackDistribution[a])[0];
          const defMult = DAMAGE_TABLE[mainEnemyAttack]?.[unit.armorType] ?? 1;
          score -= defMult * 20;
        }

        // 策略加成
        switch (this.personality) {
          case "aggressive":
            if (unit.attackType === "normal") score += 20;
            if (unit.tier === 3) score += 30;
            break;
          case "defensive":
            if (unit.armorType === "heavy") score += 20;
            if (unit.hp > 500) score += 15;
            break;
          case "balanced":
            // 需要治疗
            if (analysis && analysis.hasHealer === false && unit.skills.includes("healing_wave")) score += 40;
            break;
        }

        // 现有阵容平衡
        const currentTypes = [...this.army, ...choices.map(c => UNITS_V2[c])];
        const sameType = currentTypes.filter(u => u.type === unitType).length;
        score -= sameType * 15; // 鼓励多样性

        if (score > bestScore) {
          bestScore = score;
          bestChoice = unitType;
        }
      }

      if (bestChoice && this.resources.purchase(bestChoice)) {
        choices.push(bestChoice);
      } else {
        break;
      }
    }

    return choices;
  }

  // 执行回合
  takeTurn(enemyArmy) {
    this.turnCount++;

    // 更新战略阶段
    if (this.turnCount > 10) this.strategyPhase = "late";
    else if (this.turnCount > 5) this.strategyPhase = "mid";

    // 1. 考虑科技升级
    const techChoice = this.decideTech(enemyArmy ? this.analyzeEnemy(enemyArmy) : null);
    if (techChoice) {
      this.resources.researchTech(techChoice);
    }

    // 2. 生产单位
    const newUnits = this.decideProduction(enemyArmy);
    newUnits.forEach(u => {
      this.army.push(new UnitV2(u, this.name, this.army.length));
    });

    // 3. 获得回合收入
    this.resources.endTurn();

    return {
      techResearched: techChoice,
      unitsProduced: newUnits,
      resources: this.resources.getState()
    };
  }
}

// ==================== 导出 ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VERSION,
    ARMOR_TYPES,
    ATTACK_TYPES,
    DAMAGE_TABLE,
    SKILLS,
    TECHS,
    UNITS_V2,
    UnitV2,
    ResourceManager,
    AIBrainV2
  };
}
