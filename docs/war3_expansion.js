// ==================== 魔兽兵种对战扩展包 ====================
// v3.0 - 更多单位、技能、视觉效果
// 需配合 war3_data_v2.js 使用

// ==================== 新增技能 ====================
const SKILLS_EXPANSION = {
  // ===== 火焰系 =====
  flame_strike: {
    name: "火焰冲击",
    type: "active",
    desc: "对目标区域造成火焰伤害并点燃",
    icon: "🔥",
    cooldown: 4,
    manaCost: 70,
    effect: (unit, enemies) => {
      const targets = enemies.filter(e => !e.dead).slice(0, 3)
      targets.forEach(t => {
        t.hp -= 60
        t.burning = 3 // 燃烧3回合
      })
      return { targets: targets.length, damage: 60, effect: "burning" }
    }
  },

  phoenix_fire: {
    name: "凤凰火焰",
    type: "passive",
    desc: "攻击附带火焰伤害",
    icon: "🦅",
    effect: (unit, target, baseDmg) => {
      return { damage: baseDmg + 15, extra: "🔥+15" }
    }
  },

  // ===== 冰霜系 =====
  frost_nova: {
    name: "冰霜新星",
    type: "active",
    desc: "冰冻周围敌人并造成伤害",
    icon: "❄️",
    cooldown: 5,
    manaCost: 90,
    effect: (unit, enemies) => {
      const targets = enemies.filter(e => !e.dead && Math.abs(e.pos - unit.pos) <= 2)
      targets.forEach(t => {
        t.hp -= 45
        t.frozen = 1 // 冰冻1回合
        t.speed = Math.floor(t.speed * 0.5)
      })
      return { targets: targets.length, damage: 45, effect: "frozen" }
    }
  },

  ice_armor: {
    name: "冰甲",
    type: "active",
    desc: "为目标友军增加护甲",
    icon: "🧊",
    cooldown: 6,
    manaCost: 50,
    effect: (unit, allies) => {
      const target = allies.filter(a => !a.dead)[0]
      if (target) {
        target.armor += 8
        target.iceArmor = 3 // 持续3回合
        return { target: target.name, effect: "ice_armor" }
      }
      return {}
    }
  },

  // ===== 暗影系 =====
  shadow_strike: {
    name: "暗影突袭",
    type: "active",
    desc: "瞬移到敌人背后发动攻击",
    icon: "👤",
    cooldown: 4,
    manaCost: 60,
    effect: (unit, enemies) => {
      const target = enemies.filter(e => !e.dead)[0]
      if (target) {
        const dmg = Math.floor(unit.damage * 2.5)
        target.hp -= dmg
        return { damage: dmg, effect: "shadow" }
      }
      return {}
    }
  },

  life_drain: {
    name: "生命汲取",
    type: "active",
    desc: "吸取敌人生命恢复自身",
    icon: "💀",
    cooldown: 3,
    manaCost: 40,
    effect: (unit, enemies) => {
      const target = enemies.filter(e => !e.dead)[0]
      if (target) {
        const dmg = 50
        target.hp -= dmg
        unit.hp = Math.min(unit.max_hp, unit.hp + Math.floor(dmg * 0.8))
        return { damage: dmg, heal: Math.floor(dmg * 0.8) }
      }
      return {}
    }
  },

  // ===== 自然系 =====
  entangling_roots: {
    name: "缠绕根须",
    type: "active",
    desc: "召唤根须缠绕敌人",
    icon: "🌿",
    cooldown: 5,
    manaCost: 70,
    effect: (unit, enemies) => {
      const targets = enemies.filter(e => !e.dead).slice(0, 2)
      targets.forEach(t => {
        t.hp -= 30
        t.rooted = 2 // 缠绕2回合
      })
      return { targets: targets.length, damage: 30, effect: "rooted" }
    }
  },

  treant_summon: {
    name: "召唤树人",
    type: "active",
    desc: "召唤树人协助作战",
    icon: "🌲",
    cooldown: 12,
    manaCost: 100,
    effect: (unit, allies) => {
      for (let i = 0; i < 2; i++) {
        const treant = new UnitV2("treant", unit.owner, allies.length)
        treant.hp = 300
        treant.max_hp = 300
        treant.damage = 18
        treant.isSummon = true
        treant._marked = true
        allies.push(treant)
      }
      return { targets: 2, summon: true }
    }
  },

  // ===== 雷电系 =====
  // storm_bolt 已在主技能中定义，此处不重复

  lightning_shield: {
    name: "闪电护盾",
    type: "aura",
    desc: "对攻击者造成反伤",
    icon: "⚡",
    effect: (allies) => {
      allies.forEach(u => {
        if (!u.dead) u.lightningShield = true
      })
    }
  },

  // ===== 强化光环 =====
  command_aura: {
    name: "命令光环",
    type: "aura",
    desc: "周围友军攻击力+20%",
    icon: "👑",
    radius: 3,
    effect: (allies) => {
      allies.forEach(u => {
        if (!u.dead) u.damageBonus = (u.damageSeed || 0) + 0.2
      })
    }
  },

  unholy_aura: {
    name: "邪恶光环",
    type: "aura",
    desc: "周围友军移动速度+30%，生命回复+5",
    icon: "💀",
    radius: 3,
    effect: (allies) => {
      allies.forEach(u => {
        if (!u.dead) {
          u.speedBonus = 0.3
          u.hp = Math.min(u.max_hp, u.hp + 5)
        }
      })
    }
  },

  // ===== 终极技能 =====
  avatar: {
    name: "化身",
    type: "active",
    desc: "变身为巨人，大幅提升属性",
    icon: "🗿",
    cooldown: 15,
    manaCost: 150,
    effect: (unit) => {
      unit.avatar = true
      unit.avatarDuration = 5
      unit.hp = Math.min(unit.max_hp, unit.hp + 500)
      unit.damage += 30
      unit.armor += 10
      return { effect: "avatar" }
    }
  },

  mass_teleport: {
    name: "群体传送",
    type: "active",
    desc: "传送所有友军到目标位置",
    icon: "🌀",
    cooldown: 20,
    manaCost: 200,
    effect: (unit, allies) => {
      // 所有友军传送到英雄附近
      allies.forEach(a => {
        if (!a.dead) a.teleported = true
      })
      return { effect: "teleport", targets: allies.filter(a => !a.dead).length }
    }
  },

  earthquake: {
    name: "地震",
    type: "active",
    desc: "对敌方所有单位和建筑造成持续伤害",
    icon: "🌋",
    cooldown: 25,
    manaCost: 250,
    duration: 5,
    effect: (unit, enemies, base) => {
      enemies.filter(e => !e.dead).forEach(e => {
        e.hp -= 20
      })
      if (base) base.hp -= 50
      return { effect: "earthquake", damage: 20 }
    }
  }
}

// ==================== 新增单位 ====================
const UNITS_EXPANSION = {
  // === 火焰系 ===
  fire_elemental: {
    name: "火焰元素",
    icon: "🔥",
    cost: 180,
    goldCost: 160,
    lumberCost: 20,
    hp: 450,
    damage: 28,
    attackType: "magic",
    armorType: "none",
    armor: 0,
    speed: 300,
    range: "ranged",
    mana: 80,
    maxMana: 80,
    skills: ["flame_strike"],
    tier: 2,
    desc: "火焰魔法单位，可点燃敌人"
  },

  phoenix: {
    name: "凤凰",
    icon: "🦅",
    cost: 350,
    goldCost: 300,
    lumberCost: 50,
    hp: 600,
    damage: 35,
    attackType: "magic",
    armorType: "light",
    armor: 3,
    speed: 400,
    range: "ranged",
    mana: 150,
    maxMana: 150,
    skills: ["phoenix_fire", "flame_strike"],
    tier: 3,
    desc: "不死凤凰，攻击附带火焰伤害"
  },

  // === 冰霜系 ===
  ice_dragon: {
    name: "冰龙",
    icon: "🐉",
    cost: 400,
    goldCost: 350,
    lumberCost: 50,
    hp: 900,
    damage: 40,
    attackType: "magic",
    armorType: "heavy",
    armor: 8,
    speed: 280,
    range: "ranged",
    mana: 200,
    maxMana: 200,
    skills: ["frost_nova", "blizzard"],
    tier: 3,
    desc: "冰霜巨龙，大范围冰冻攻击"
  },

  frost_wyrm: {
    name: "霜冻巨龙",
    icon: "❄️",
    cost: 380,
    goldCost: 320,
    lumberCost: 60,
    hp: 850,
    damage: 45,
    attackType: "magic",
    armorType: "heavy",
    armor: 6,
    speed: 250,
    range: "ranged",
    mana: 180,
    maxMana: 180,
    skills: ["frost_nova"],
    tier: 3,
    desc: "亡灵冰龙，减速敌人"
  },

  // === 暗影系 ===
  shadow_hunter: {
    name: "暗影猎手",
    icon: "👤",
    cost: 280,
    goldCost: 240,
    lumberCost: 40,
    hp: 550,
    damage: 30,
    attackType: "hero",
    armorType: "light",
    armor: 5,
    speed: 350,
    range: "ranged",
    mana: 120,
    maxMana: 120,
    skills: ["shadow_strike", "life_drain"],
    tier: 3,
    desc: "暗杀者，擅长偷袭和吸血"
  },

  necromancer: {
    name: "死灵法师",
    icon: "💀",
    cost: 200,
    goldCost: 170,
    lumberCost: 30,
    hp: 350,
    damage: 15,
    attackType: "magic",
    armorType: "none",
    armor: 1,
    speed: 280,
    range: "ranged",
    mana: 150,
    maxMana: 150,
    skills: ["life_drain"],
    tier: 2,
    desc: "亡灵法师，汲取生命"
  },

  // === 自然系 ===
  druid: {
    name: "德鲁伊",
    icon: "🌿",
    cost: 250,
    goldCost: 220,
    lumberCost: 30,
    hp: 500,
    damage: 22,
    attackType: "magic",
    armorType: "medium",
    armor: 4,
    speed: 300,
    range: "ranged",
    mana: 130,
    maxMana: 130,
    skills: ["entangling_roots", "treant_summon"],
    tier: 2,
    desc: "自然守护者，召唤树人"
  },

  treant: {
    name: "树人",
    icon: "🌲",
    cost: 0,
    goldCost: 0,
    lumberCost: 0,
    hp: 300,
    damage: 18,
    attackType: "normal",
    armorType: "medium",
    armor: 5,
    speed: 220,
    range: "melee",
    mana: 0,
    maxMana: 0,
    skills: [],
    tier: 1,
    desc: "召唤单位"
  },

  // === 雷电系 ===
  thunder_god: {
    name: "雷神",
    icon: "⚡",
    cost: 320,
    goldCost: 280,
    lumberCost: 40,
    hp: 650,
    damage: 32,
    attackType: "hero",
    armorType: "hero",
    armor: 6,
    speed: 320,
    range: "ranged",
    mana: 180,
    maxMana: 180,
    skills: ["storm_bolt", "chain_lightning", "lightning_shield"],
    tier: 3,
    desc: "雷电之神，连锁闪电"
  },

  // === 精英单位 ===
  demon_hunter: {
    name: "恶魔猎手",
    icon: "😈",
    cost: 400,
    goldCost: 350,
    lumberCost: 50,
    hp: 700,
    damage: 38,
    attackType: "hero",
    armorType: "hero",
    armor: 7,
    speed: 360,
    range: "melee",
    mana: 150,
    maxMana: 150,
    skills: ["evasion", "critical_strike", "vampiric"],
    tier: 3,
    desc: "伊利丹！高闪避高暴击吸血"
  },

  paladin: {
    name: "圣骑士",
    icon: "🛡️",
    cost: 380,
    goldCost: 330,
    lumberCost: 50,
    hp: 900,
    damage: 28,
    attackType: "hero",
    armorType: "hero",
    armor: 12,
    speed: 280,
    range: "melee",
    mana: 200,
    maxMana: 200,
    skills: ["healing_wave", "armor_aura"],
    tier: 3,
    desc: "神圣骑士，治疗和护甲光环"
  },

  // === 攻城单位 ===
  demolisher: {
    name: "粉碎者",
    icon: "💣",
    cost: 250,
    goldCost: 200,
    lumberCost: 50,
    hp: 550,
    damage: 50,
    attackType: "siege",
    armorType: "fortified",
    armor: 10,
    speed: 180,
    range: "ranged",
    mana: 0,
    maxMana: 0,
    skills: [],
    tier: 2,
    desc: "重型攻城单位，对建筑毁灭性打击"
  }
}

// ==================== 新增英雄 ====================
const HEROES_EXPANSION = {
  // 火焰领主
  fire_lord: {
    name: "火焰领主",
    icon: "🔥",
    cost: 0,
    goldCost: 0,
    lumberCost: 80,
    hp: 800,
    max_hp: 800,
    damage: 30,
    attackType: "hero",
    armorType: "hero",
    armor: 5,
    speed: 320,
    attackSpeed: 1.4,
    range: "ranged",
    mana: 250,
    maxMana: 250,
    manaRegen: 4,
    skills: ["flame_strike", "phoenix_fire"],
    tier: 4,
    attrType: "intelligence",
    desc: "火焰法师，毁灭性火焰魔法"
  },

  // 冰霜女王
  ice_queen: {
    name: "冰霜女王",
    icon: "❄️",
    cost: 0,
    goldCost: 0,
    lumberCost: 80,
    hp: 650,
    max_hp: 650,
    damage: 28,
    attackType: "hero",
    armorType: "hero",
    armor: 4,
    speed: 300,
    attackSpeed: 1.3,
    range: "ranged",
    mana: 280,
    maxMana: 280,
    manaRegen: 5,
    skills: ["frost_nova", "ice_armor", "blizzard"],
    tier: 4,
    attrType: "intelligence",
    desc: "冰霜女王，冻结一切敌人"
  },

  // 暗影刺客
  shadow_assassin: {
    name: "暗影刺客",
    icon: "👤",
    cost: 0,
    goldCost: 0,
    lumberCost: 60,
    hp: 550,
    max_hp: 550,
    damage: 35,
    attackType: "hero",
    armorType: "hero",
    armor: 3,
    speed: 420,
    attackSpeed: 2.0,
    range: "melee",
    mana: 150,
    maxMana: 150,
    manaRegen: 3,
    skills: ["shadow_strike", "evasion", "critical_strike"],
    tier: 4,
    attrType: "agility",
    desc: "暗影刺客，瞬移暗杀"
  },

  // 自然守护者
  nature_guardian: {
    name: "自然守护者",
    icon: "🌳",
    cost: 0,
    goldCost: 0,
    lumberCost: 70,
    hp: 900,
    max_hp: 900,
    damage: 25,
    attackType: "hero",
    armorType: "hero",
    armor: 8,
    speed: 280,
    attackSpeed: 1.1,
    range: "melee",
    mana: 200,
    maxMana: 200,
    manaRegen: 4,
    skills: ["treant_summon", "entangling_roots", "healing_wave"],
    tier: 4,
    attrType: "strength",
    desc: "自然守护者，召唤树人作战"
  }
}

// ==================== 合并到主数据 ====================
function applyExpansion() {
  // 使用全局引用（兼容浏览器和Node.js eval环境）
  const _SKILLS = (typeof window !== 'undefined' && window.SKILLS) || (typeof SKILLS !== 'undefined' ? SKILLS : null);
  const _UNITS = (typeof window !== 'undefined' && window.UNITS_V2) || (typeof UNITS_V2 !== 'undefined' ? UNITS_V2 : null);
  const _HEROES = (typeof window !== 'undefined' && window.HEROES) || (typeof HEROES !== 'undefined' ? HEROES : null);

  if (!_SKILLS || !_UNITS || !_HEROES) {
    console.warn('扩展包：主数据未就绪，跳过合并');
    return;
  }

  // 合并技能
  Object.assign(_SKILLS, SKILLS_EXPANSION)
  
  // 合并单位
  Object.assign(_UNITS, UNITS_EXPANSION)
  
  // 合并英雄
  Object.assign(_HEROES, HEROES_EXPANSION)
  
  console.log("扩展包已加载！新增:",
    Object.keys(SKILLS_EXPANSION).length, "个技能,",
    Object.keys(UNITS_EXPANSION).length, "个单位,",
    Object.keys(HEROES_EXPANSION).length, "个英雄"
  )

  // 同步到window（浏览器环境）
  if (typeof window !== 'undefined') {
    window.SKILLS = _SKILLS;
    window.UNITS_V2 = _UNITS;
    window.HEROES = _HEROES;
  }
}

// 自动应用
applyExpansion()