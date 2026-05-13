// war3-arena: 魔兽竞技场 - 玩家 vs AI 回合制策略对战
const VERSION = "0.1.0";

// ==================== 伤害表 ====================
const DAMAGE_TABLE = {
  normal:   { light: 1.5, medium: 1.0, heavy: 0.7, fortified: 0.5, none: 1.0, hero: 1.0 },
  pierce:   { light: 1.0, medium: 0.75, heavy: 0.7, fortified: 0.35, none: 1.5, hero: 1.0 },
  magic:    { light: 1.25, medium: 0.75, heavy: 1.25, fortified: 0.2, none: 1.0, hero: 0.5 },
  siege:    { light: 1.0, medium: 0.5, heavy: 1.0, fortified: 1.5, none: 0.8, hero: 1.0 },
  hero:     { light: 1.0, medium: 1.0, heavy: 1.0, fortified: 0.5, none: 1.0, hero: 1.0 },
};

// ==================== 兵种数据 ====================
const UNITS = {
  footman:      { name:"步兵",     icon:"⚔️", tier:1, cost:110, lumber:0,  hp:460,  damage:14, armor:4,  armorType:"medium",   attackType:"normal", speed:300, range:0,  skills:[], type:"footman" },
  archer:       { name:"弓箭手",   icon:"🏹", tier:1, cost:110, lumber:20, hp:320,  damage:12, armor:1,  armorType:"light",    attackType:"pierce", speed:330, range:400,skills:[], type:"archer" },
  mage:         { name:"法师",     icon:"🔮", tier:1, cost:150, lumber:30, hp:300,  damage:18, armor:0,  armorType:"none",     attackType:"magic",  speed:280, range:350,skills:["fireball"], type:"mage" },
  rifleman:     { name:"火枪手",   icon:"🔫", tier:1, cost:140, lumber:25, hp:380,  damage:20, armor:2,  armorType:"medium",   attackType:"pierce", speed:270, range:450,skills:[], type:"rifleman" },
  knight:       { name:"骑士",     icon:"🐎", tier:2, cost:280, lumber:50, hp:750,  damage:28, armor:6,  armorType:"heavy",    attackType:"normal", speed:350, range:0,  skills:[], type:"knight", requires:["tier2"] },
  siege_engine: { name:"投石车",   icon:"💥", tier:2, cost:240, lumber:70, hp:500,  damage:45, armor:2,  armorType:"fortified",attackType:"siege",  speed:180, range:500,skills:[], type:"siege_engine", requires:["tier2"] },
  priest:       { name:"牧师",     icon:"✝️", tier:2, cost:145, lumber:30, hp:340,  damage:10, armor:1,  armorType:"none",     attackType:"magic",  speed:290, range:350,skills:["healing_wave"], type:"priest", requires:["tier2"] },
  sorceress:    { name:"女巫",     icon:"🧙‍♀️", tier:2, cost:135, lumber:40, hp:265,  damage:10, armor:0,  armorType:"none",     attackType:"magic",  speed:280, range:400,skills:["slow"], type:"sorceress", requires:["tier2"] },
  dragonhawk:   { name:"龙鹰",     icon:"🦅", tier:2, cost:220, lumber:50, hp:550,  damage:22, armor:3,  armorType:"light",    attackType:"magic",  speed:360, range:300,skills:["aerial_shackle"], type:"dragonhawk", requires:["tier2"] },
  abomination:  { name:"憎恶",     icon:"🧟", tier:2, cost:260, lumber:60, hp:850,  damage:30, armor:4,  armorType:"heavy",    attackType:"normal", speed:250, range:0,  skills:["disease_cloud"], type:"abomination", requires:["tier2"] },
  tauren:       { name:"牛头人",   icon:"🐂", tier:3, cost:380, lumber:80, hp:1100, damage:38, armor:5,  armorType:"heavy",    attackType:"normal", speed:270, range:0,  skills:["pulverize"], type:"tauren", requires:["tier3"] },
  blademaster:  { name:"剑圣",     icon:"🗡️", tier:3, cost:350, lumber:60, hp:700,  damage:45, armor:3,  armorType:"hero",     attackType:"hero",   speed:380, range:0,  skills:["mirror_image","wind_walk","critical_strike"], type:"blademaster", requires:["tier3"], isHero:true },
  mountain_king:{ name:"山丘之王", icon:"🔨", tier:3, cost:350, lumber:60, hp:900,  damage:35, armor:7,  armorType:"hero",     attackType:"hero",   speed:300, range:0,  skills:["thunder_clap","storm_bolt","bash"], type:"mountain_king", requires:["tier3"], isHero:true },
  archmage:     { name:"大法师",   icon:"🧙", tier:3, cost:350, lumber:60, hp:600,  damage:25, armor:2,  armorType:"hero",     attackType:"hero",   speed:290, range:400,skills:["summon_water_elemental","blizzard","brilliance_aura"], type:"archmage", requires:["tier3"], isHero:true },
  dreadlord:    { name:"恐惧魔王", icon:"😈", tier:3, cost:350, lumber:60, hp:800,  damage:38, armor:5,  armorType:"hero",     attackType:"hero",   speed:310, range:0,  skills:["carrion_swarm","sleep","vampiric_aura"], type:"dreadlord", requires:["tier3"], isHero:true },
};

// ==================== 科技树 ====================
const TECHS = {
  tier2: { name:"二级基地", cost:200, lumber:80, description:"解锁T2兵种" },
  tier3: { name:"三级基地", cost:400, lumber:150, description:"解锁T3兵种/英雄", requires:["tier2"] },
};

// ==================== 英雄选择 ====================
const HEROES = {
  blademaster:   UNITS.blademaster,
  mountain_king: UNITS.mountain_king,
  archmage:      UNITS.archmage,
  dreadlord:     UNITS.dreadlord,
};

// ==================== 单位实例 ====================
let unitIdCounter = 0;
class Unit {
  constructor(type, team) {
    const data = UNITS[type];
    Object.assign(this, {
      id: ++unitIdCounter,
      type, team,
      name: data.name, icon: data.icon,
      max_hp: data.hp, hp: data.hp,
      damage: data.damage, armor: data.armor,
      armorType: data.armorType, attackType: data.attackType,
      speed: data.speed, range: data.range,
      skills: [...data.skills],
      isHero: data.isHero || false,
      isSummon: false,
      tier: data.tier,
      dead: false,
      stun: 0, slow: 0,
      _newSpawn: true,
    });
  }

  effectiveDamage() {
    let d = this.damage;
    if (this.slow > 0) d *= 0.5;
    return Math.round(d);
  }

  effectiveArmor() {
    return Math.max(0, this.armor - (this.slow > 0 ? 2 : 0));
  }

  takeDamage(rawDmg, attackerAtkType) {
    const mult = DAMAGE_TABLE[attackerAtkType]?.[this.armorType] ?? 1;
    const armorReduction = this.effectiveArmor() * 0.06 / (1 + this.effectiveArmor() * 0.06);
    const finalDmg = Math.round(rawDmg * mult * (1 - armorReduction));
    this.hp -= finalDmg;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    return { finalDmg, mult: Math.round(mult * 100) / 100, armorReduction: Math.round(armorReduction * 100) / 100 };
  }
}

// ==================== 资源系统 ====================
class Resources {
  constructor(gold = 500, lumber = 500) {
    this.gold = gold;
    this.lumber = lumber;
    this.goldPerTurn = 40;
    this.lumberPerTurn = 20;
    this.techs = [];
  }

  canAfford(type) {
    const u = UNITS[type];
    return this.gold >= u.cost && this.lumber >= u.lumber;
  }

  canAffordTech(techId) {
    const t = TECHS[techId];
    return this.gold >= t.cost && this.lumber >= t.lumber;
  }

  purchase(type) {
    if (!this.canAfford(type)) return false;
    const u = UNITS[type];
    this.gold -= u.cost;
    this.lumber -= u.lumber;
    return true;
  }

  researchTech(techId) {
    if (!this.canAffordTech(techId)) return false;
    const t = TECHS[techId];
    if (this.techs.includes(techId)) return false;
    if (t.requires && !t.requires.every(r => this.techs.includes(r))) return false;
    this.gold -= t.cost;
    this.lumber -= t.lumber;
    this.techs.push(techId);
    return true;
  }

  addIncome(mult = 1.0) {
    this.gold += Math.round(this.goldPerTurn * mult);
    this.lumber += Math.round(this.lumberPerTurn * mult);
  }
}

// ==================== AI 大脑 ====================
class AIBrain {
  constructor(personality = "balanced", difficulty = "normal") {
    this.personality = personality;
    this.resources = new Resources();
    this.army = [];
    this.heroType = null;
    this.heroLevel = 1;
    this.heroReviveTimer = 0;
    this.hasHero = false;
    this.strategyPhase = "early";
    this.difficulty = difficulty;
    this.diffParams = this._diffParams(difficulty);
  }

  _diffParams(d) {
    const map = {
      easy:   { incomeMult: 0.7, scoreNoise: 40, counterWeight: 0.8, armyCap: 12 },
      normal: { incomeMult: 1.0, scoreNoise: 0,  counterWeight: 1.0, armyCap: 16 },
      hard:   { incomeMult: 1.3, scoreNoise: 0,  counterWeight: 1.5, armyCap: 20 },
    };
    return map[d] || map.normal;
  }

  analyzeEnemy(enemyArmy) {
    const attackDistribution = {};
    const armorDistribution = {};
    let hasHealer = false;
    for (const u of enemyArmy) {
      if (u.dead) continue;
      attackDistribution[u.attackType] = (attackDistribution[u.attackType] || 0) + 1;
      armorDistribution[u.armorType] = (armorDistribution[u.armorType] || 0) + 1;
      if (u.skills.includes("healing_wave")) hasHealer = true;
    }
    return { attackDistribution, armorDistribution, hasHealer, total: enemyArmy.filter(u => !u.dead).length };
  }

  // 单次出兵决策，返回 { type, reason, score } 或 null
  decideOneUnit(enemyArmy) {
    const analysis = enemyArmy ? this.analyzeEnemy(enemyArmy) : null;
    const livingCount = this.army.filter(u => !u.dead).length;
    if (livingCount >= this.diffParams.armyCap) return null;
    const targetSize = this.strategyPhase === "early" ? 6 : this.strategyPhase === "mid" ? 10 : 14;
    if (livingCount >= targetSize) return null;

    const available = Object.keys(UNITS).filter(u => {
      const unit = UNITS[u];
      if (unit.isSummon) return false;
      if (!this.resources.canAfford(u)) return false;
      if (unit.requires && !unit.requires.every(r => this.resources.techs.includes(r))) return false;
      if (unit.isHero && this.hasHero) return false;
      return true;
    });
    if (available.length === 0) return null;

    let bestChoice = null, bestScore = -Infinity, bestReason = "";
    for (const unitType of available) {
      const unit = UNITS[unitType];
      let score = 0;
      const reasons = [];

      if (this.diffParams.scoreNoise > 0) score += (Math.random() - 0.5) * this.diffParams.scoreNoise;
      score += unit.damage / unit.cost * 150;
      score += unit.hp / unit.cost * 30;
      if (unit.attackType === "siege") { score += 80; reasons.push("攻城"); }
      if (unit.attackType === "magic" && unit.tier >= 2) { score += 30; reasons.push("魔法"); }

      if (analysis) {
        let counterScore = 0;
        const cw = this.diffParams.counterWeight || 1.0;
        for (const [armorType, count] of Object.entries(analysis.armorDistribution)) {
          const mult = DAMAGE_TABLE[unit.attackType]?.[armorType] ?? 1;
          counterScore += (mult - 1) * count * 50 * cw;
        }
        if (counterScore > 0) { score += counterScore; reasons.push("克制敌甲"); }
        let defScore = 0;
        for (const [atkType, count] of Object.entries(analysis.attackDistribution)) {
          const mult = DAMAGE_TABLE[atkType]?.[unit.armorType] ?? 1;
          defScore -= (mult - 1) * count * 30;
        }
        if (defScore < 0) { score += defScore; reasons.push("抗敌攻击"); }
      }

      switch (this.personality) {
        case "aggressive":
          if (unit.attackType === "siege") score += 80;
          if (unit.attackType === "normal") score += 25;
          if (unit.tier === 1 && this.strategyPhase === "early") { score += 40; reasons.push("前期爆兵"); }
          if (unit.tier === 3) score += 30;
          break;
        case "defensive":
          if (unit.armorType === "heavy") { score += 20; reasons.push("重甲"); }
          if (unit.hp > 500) { score += 15; reasons.push("高血量"); }
          break;
        case "balanced":
          if (analysis && !analysis.hasHealer && unit.skills.includes("healing_wave")) { score += 40; reasons.push("需要治疗"); }
          break;
      }

      const sameType = this.army.filter(u => u.type === unitType).length;
      if (sameType >= 5) continue;
      score -= sameType * 60;

      if (score > bestScore) {
        bestScore = score;
        bestChoice = unitType;
        bestReason = reasons.length > 0 ? reasons.join(",") : "性价比";
      }
    }

    if (bestChoice && this.resources.purchase(bestChoice)) {
      return { type: bestChoice, reason: bestReason, score: Math.round(bestScore) };
    }
    return null;
  }

  // 英雄处理
  handleHero(enemyArmy) {
    let spawned = null, revived = false;
    // 选择英雄
    if (!this.heroType) {
      const heroList = Object.keys(HEROES);
      this.heroType = heroList[Math.floor(Math.random() * heroList.length)];
    }
    // 复活计时
    if (this.hasHero) {
      const hero = this.army.find(u => u.isHero);
      if (hero && hero.dead) {
        if (this.heroReviveTimer > 0) {
          this.heroReviveTimer--;
        } else {
          hero.hp = Math.round(hero.max_hp * 0.5);
          hero.dead = false;
          this.resources.gold -= this.heroLevel * 100;
          this.heroLevel++;
          hero.max_hp += 50; hero.hp += 50;
          hero.damage += 2; hero.armor += 0.5;
          revived = true;
        }
      }
    }
    // 生成英雄
    if (!this.hasHero && this.resources.canAfford(this.heroType)) {
      // 英雄免费生成
      const hero = new Unit(this.heroType, "red");
      hero.isHero = true;
      this.army.unshift(hero);
      this.hasHero = true;
      spawned = this.heroType;
    }
    return { spawned, revived };
  }

  takeTurn(enemyArmy) {
    this.resources.addIncome(this.diffParams.incomeMult);

    // 策略阶段更新
    const living = this.army.filter(u => !u.dead).length;
    if (living >= 8) this.strategyPhase = "mid";
    if (living >= 12) this.strategyPhase = "late";

    // 清理死亡单位
    this.army = this.army.filter(u => !u.dead || u.isHero);

    // 英雄
    const heroResult = this.handleHero(enemyArmy);

    // 科技
    let techChoice = null;
    if (!this.resources.techs.includes("tier2") && this.resources.gold >= 250) techChoice = "tier2";
    else if (!this.resources.techs.includes("tier3") && this.resources.gold >= 500 && this.resources.techs.includes("tier2")) techChoice = "tier3";
    if (techChoice) this.resources.researchTech(techChoice);

    // 出兵（逐个决策）
    const productionReasons = [];
    for (let i = 0; i < 5; i++) {
      const pick = this.decideOneUnit(enemyArmy);
      if (!pick) break;
      const unit = new Unit(pick.type, "red");
      this.army.push(unit);
      productionReasons.push(pick);
    }

    return { heroResult, techChoice, productionReasons, resources: { gold: this.resources.gold, lumber: this.resources.lumber, techs: [...this.resources.techs] } };
  }
}

// ==================== 战斗引擎 ====================
class BattleEngine {
  static resolveCombat(blueArmy, redArmy, blueBase, redBase) {
    const log = [];
    const allUnits = [...blueArmy.filter(u => !u.dead), ...redArmy.filter(u => !u.dead)];
    // 按速度排序
    allUnits.sort((a, b) => b.speed - a.speed);

    for (const attacker of allUnits) {
      if (attacker.dead || attacker.stun > 0) { if (attacker.stun > 0) attacker.stun--; continue; }
      if (attacker.slow > 0) attacker.slow--;

      const enemies = (attacker.team === "blue" ? redArmy : blueArmy).filter(u => !u.dead);
      const allies = (attacker.team === "blue" ? blueArmy : redArmy).filter(u => !u.dead && u.id !== attacker.id);
      const base = attacker.team === "blue" ? redBase : blueBase;

      // 技能优先
      let acted = this.useSkills(attacker, enemies, allies, log);

      // 普通攻击
      if (!acted && enemies.length > 0) {
        const target = this.pickTarget(attacker, enemies);
        const result = target.takeDamage(attacker.effectiveDamage(), attacker.attackType);
        log.push({ type: "attack", attacker: attacker.name, attackerIcon: attacker.icon, attackerTeam: attacker.team, target: target.name, targetIcon: target.icon, damage: result.finalDmg, mult: result.mult });
        if (target.dead) {
          log.push({ type: "kill", killer: attacker.name, killerIcon: attacker.icon, killerTeam: attacker.team, victim: target.name, victimIcon: target.icon });
        }
      }

      // 围城
      if (!acted && enemies.length === 0 && base.hp > 0) {
        const siegeDmg = Math.round(attacker.effectiveDamage() * 0.5);
        const mult = DAMAGE_TABLE[attacker.attackType]?.["fortified"] ?? 1;
        const actualDmg = Math.round(siegeDmg * mult);
        base.hp -= actualDmg;
        log.push({ type: "siege", unit: attacker.name, unitIcon: attacker.icon, team: attacker.team, damage: actualDmg, baseHp: base.hp });
      }
    }

    return log;
  }

  static pickTarget(attacker, enemies) {
    // 优先攻击低血量
    return enemies.reduce((min, e) => e.hp < min.hp ? e : min, enemies[0]);
  }

  static useSkills(attacker, enemies, allies, log) {
    if (attacker.stun > 0 || attacker.dead) return false;

    for (const skillId of attacker.skills) {
      switch (skillId) {
        case "healing_wave": {
          const wounded = allies.filter(u => u.hp < u.max_hp * 0.7);
          if (wounded.length > 0) {
            const target = wounded.reduce((a, b) => a.hp / a.max_hp < b.hp / b.max_hp ? a : b);
            const heal = Math.round(40 + attacker.damage * 0.5);
            target.hp = Math.min(target.max_hp, target.hp + heal);
            log.push({ type: "heal", unit: attacker.name, unitIcon: attacker.icon, target: target.name, heal, team: attacker.team });
            return true;
          }
          break;
        }
        case "slow": {
          if (enemies.length > 0) {
            const target = enemies.reduce((a, b) => a.speed > b.speed ? a : b);
            target.slow = 3;
            log.push({ type: "skill", unit: attacker.name, unitIcon: attacker.icon, skill: "减速", target: target.name, targetIcon: target.icon, team: attacker.team });
            return true;
          }
          break;
        }
        case "thunder_clap": {
          const nearby = enemies.slice(0, 3);
          for (const e of nearby) { e.stun = 1; e.takeDamage(40, "magic"); }
          log.push({ type: "aoe", unit: attacker.name, unitIcon: attacker.icon, skill: "雷霆一击", targets: nearby.map(e => e.name), damage: 40, team: attacker.team });
          return true;
        }
        case "mirror_image": {
          const summonCount = Math.min(2, 3 - allies.filter(u => u.isSummon && u.type === attacker.type).length);
          for (let i = 0; i < summonCount; i++) {
            const clone = new Unit(attacker.type, attacker.team);
            clone.isSummon = true;
            clone.hp = Math.round(attacker.max_hp * 0.1);
            clone.max_hp = clone.hp;
            clone.damage = Math.round(attacker.damage * 0.1);
            clone.name = attacker.name + "分身";
            // 临时加入
          }
          log.push({ type: "skill", unit: attacker.name, unitIcon: attacker.icon, skill: "镜像", team: attacker.team });
          return true;
        }
        case "summon_water_elemental": {
          const we = new Unit("mage", attacker.team);
          we.isSummon = true;
          we.name = "水元素";
          we.icon = "💧";
          we.hp = 350; we.max_hp = 350;
          we.damage = 22; we.armor = 0;
          we.attackType = "magic"; we.armorType = "none";
          we.range = 400;
          log.push({ type: "skill", unit: attacker.name, unitIcon: attacker.icon, skill: "召唤水元素", team: attacker.team });
          return true;
        }
        case "critical_strike": {
          if (Math.random() < 0.25 && enemies.length > 0) {
            const target = this.pickTarget(attacker, enemies);
            const critDmg = attacker.effectiveDamage() * 2;
            const result = target.takeDamage(critDmg, attacker.attackType);
            log.push({ type: "crit", attacker: attacker.name, attackerIcon: attacker.icon, target: target.name, targetIcon: target.icon, damage: result.finalDmg, team: attacker.team });
            if (target.dead) log.push({ type: "kill", killer: attacker.name, killerIcon: attacker.icon, killerTeam: attacker.team, victim: target.name, victimIcon: target.icon });
            return true;
          }
          break;
        }
        case "storm_bolt": {
          if (enemies.length > 0 && Math.random() < 0.3) {
            const target = enemies.find(u => u.isHero) || enemies[0];
            target.stun = 2;
            target.takeDamage(60, "hero");
            log.push({ type: "skill", unit: attacker.name, unitIcon: attacker.icon, skill: "风暴之锤", target: target.name, targetIcon: target.icon, team: attacker.team });
            return true;
          }
          break;
        }
        case "brilliance_aura": {
          // 被动光环 - 每回合自动触发
          allies.forEach(a => { if (!a.isHero) a.damage += 1; });
          break;
        }
        case "vampiric_aura": {
          // 被动 - 吸血
          break;
        }
        case "disease_cloud": {
          enemies.slice(0, 3).forEach(e => { e.hp -= 8; if (e.hp <= 0) { e.hp = 0; e.dead = true; } });
          return true;
        }
        case "pulverize": {
          if (Math.random() < 0.25) {
            enemies.slice(0, 3).forEach(e => e.takeDamage(25, "normal"));
            log.push({ type: "aoe", unit: attacker.name, unitIcon: attacker.icon, skill: "粉碎", targets: enemies.slice(0, 3).map(e => e.name), damage: 25, team: attacker.team });
            return true;
          }
          break;
        }
        case "fireball": {
          if (enemies.length > 0) {
            const target = this.pickTarget(attacker, enemies);
            target.takeDamage(attacker.damage * 1.5, "magic");
            log.push({ type: "skill", unit: attacker.name, unitIcon: attacker.icon, skill: "火球术", target: target.name, targetIcon: target.icon, team: attacker.team });
            return true;
          }
          break;
        }
        case "aerial_shackle": {
          const flying = enemies.find(u => u.armorType === "light" && u.range > 0);
          if (flying) {
            flying.stun = 3;
            flying.takeDamage(15, "magic");
            log.push({ type: "skill", unit: attacker.name, unitIcon: attacker.icon, skill: "空中枷锁", target: flying.name, targetIcon: flying.icon, team: attacker.team });
            return true;
          }
          break;
        }
        case "wind_walk": {
          if (attacker.hp < attacker.max_hp * 0.3) {
            attacker.stun = -1; // 隐身1回合
            log.push({ type: "skill", unit: attacker.name, unitIcon: attacker.icon, skill: "疾风步", team: attacker.team });
            return true;
          }
          break;
        }
        case "carrion_swarm": {
          enemies.slice(0, 4).forEach(e => e.takeDamage(35, "magic"));
          log.push({ type: "aoe", unit: attacker.name, unitIcon: attacker.icon, skill: "腐臭蜂群", targets: enemies.slice(0, 4).map(e => e.name), damage: 35, team: attacker.team });
          return true;
        }
        case "sleep": {
          const target = enemies.find(u => u.isHero) || enemies[0];
          target.stun = 3;
          log.push({ type: "skill", unit: attacker.name, unitIcon: attacker.icon, skill: "睡眠", target: target.name, targetIcon: target.icon, team: attacker.team });
          return true;
        }
        case "bash": {
          if (Math.random() < 0.15) {
            const target = enemies[0];
            target.stun = 1;
            log.push({ type: "skill", unit: attacker.name, unitIcon: attacker.icon, skill: "重击", target: target.name, targetIcon: target.icon, team: attacker.team });
          }
          break;
        }
        case "blizzard": {
          enemies.slice(0, 5).forEach(e => e.takeDamage(30, "magic"));
          log.push({ type: "aoe", unit: attacker.name, unitIcon: attacker.icon, skill: "暴风雪", targets: enemies.slice(0, 5).map(e => e.name), damage: 30, team: attacker.team });
          return true;
        }
      }
    }
    return false;
  }
}

// ==================== 游戏主控 ====================
class Game {
  constructor(mode = "battle", difficulty = "normal") {
    this.mode = mode; // "battle" | "spectate"
    this.difficulty = difficulty;
    this.turn = 0;
    this.phase = "hero_select"; // hero_select → player_turn → ai_turn → combat → income → ...
    this.blueBase = { hp: 3000, maxHp: 3000 };
    this.redBase = { hp: 3000, maxHp: 3000 };
    this.blueResources = new Resources();
    this.blueArmy = [];
    this.blueHero = null;
    this.blueTechs = [];
    this.redBrain = new AIBrain("balanced", difficulty);
    this.combatLog = [];
    this.aiLog = [];
    this.gameOver = false;
    this.winner = null;
    this.callbacks = {};
  }

  on(event, fn) { this.callbacks[event] = fn; }
  emit(event, data) { if (this.callbacks[event]) this.callbacks[event](data); }

  // 玩家选择英雄
  selectHero(heroType) {
    if (this.phase !== "hero_select") return;
    this.blueHero = heroType;
    const hero = new Unit(heroType, "blue");
    hero.isHero = true;
    this.blueArmy.push(hero);
    this.phase = "player_turn";
    this.emit("phaseChange", this.phase);
  }

  // 玩家出兵
  playerProduce(unitType) {
    if (this.phase !== "player_turn") return { ok: false, reason: "不是你的回合" };
    const data = UNITS[unitType];
    if (!data) return { ok: false, reason: "无效兵种" };
    if (data.isHero) return { ok: false, reason: "英雄已选择" };
    if (!this.blueResources.canAfford(unitType)) return { ok: false, reason: "资源不足" };
    if (data.requires && !data.requires.every(r => this.blueResources.techs.includes(r))) return { ok: false, reason: "科技未解锁" };
    const livingCount = this.blueArmy.filter(u => !u.dead).length;
    if (livingCount >= 16) return { ok: false, reason: "军队已满(16)" };

    this.blueResources.purchase(unitType);
    const unit = new Unit(unitType, "blue");
    this.blueArmy.push(unit);
    this.emit("unitProduced", { type: unitType, unit, team: "blue" });
    return { ok: true, unit };
  }

  // 玩家研究科技
  playerResearch(techId) {
    if (this.phase !== "player_turn") return { ok: false };
    if (!this.blueResources.canAffordTech(techId)) return { ok: false, reason: "资源不足" };
    if (this.blueResources.techs.includes(techId)) return { ok: false, reason: "已研究" };
    const tech = TECHS[techId];
    if (tech.requires && !tech.requires.every(r => this.blueResources.techs.includes(r))) return { ok: false, reason: "前置科技未研究" };
    this.blueResources.researchTech(techId);
    this.emit("techResearched", { techId, team: "blue" });
    return { ok: true };
  }

  // 结束玩家回合
  endPlayerTurn() {
    if (this.phase !== "player_turn") return;
    this.phase = "ai_turn";
    this.emit("phaseChange", this.phase);

    // AI出兵
    const result = this.redBrain.takeTurn(this.blueArmy.filter(u => !u.dead));
    this.aiLog = result.productionReasons;
    if (result.techChoice) this.emit("techResearched", { techId: result.techChoice, team: "red" });

    // 进入战斗
    this.phase = "combat";
    this.emit("phaseChange", this.phase);
    this.resolveCombat();
  }

  // 战斗结算
  resolveCombat() {
    this.combatLog = BattleEngine.resolveCombat(
      this.blueArmy, this.redBrain.army,
      this.blueBase, this.redBase
    );
    this.emit("combatResolved", this.combatLog);

    // 检查胜负
    if (this.blueBase.hp <= 0) {
      this.gameOver = true;
      this.winner = "red";
      this.emit("gameOver", this.winner);
      return;
    }
    if (this.redBase.hp <= 0) {
      this.gameOver = true;
      this.winner = "blue";
      this.emit("gameOver", this.winner);
      return;
    }

    // 收入
    this.turn++;
    this.blueResources.addIncome();
    this.emit("turnEnd", this.turn);

    // 清理死亡非英雄单位
    this.blueArmy = this.blueArmy.filter(u => !u.dead || u.isHero);
    this.redBrain.army = this.redBrain.army.filter(u => !u.dead || u.isHero);

    // 下一回合
    this.phase = "player_turn";
    this.emit("phaseChange", this.phase);
  }

  // 观战模式：自动进行
  spectateTick() {
    if (this.mode !== "spectate") return;
    // 蓝方也用AI
    if (!this.blueHero) {
      const heroList = Object.keys(HEROES);
      this.selectHero(heroList[Math.floor(Math.random() * heroList.length)]);
    }
    // 蓝方自动出兵
    const blueAI = new AIBrain("balanced", this.difficulty);
    blueAI.resources = this.blueResources;
    blueAI.army = this.blueArmy;
    blueAI.hasHero = !!this.blueHero;
    blueAI.heroType = this.blueHero;
    for (let i = 0; i < 5; i++) {
      const pick = blueAI.decideOneUnit(this.redBrain.army.filter(u => !u.dead));
      if (!pick) break;
      this.blueResources.purchase(pick.type);
      this.blueArmy.push(new Unit(pick.type, "blue"));
    }
    this.endPlayerTurn();
  }
}
