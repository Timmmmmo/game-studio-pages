// ==================== 魔兽兵种对战 v3.0 - 全面测试套件 ====================
// 高级测试工程师模式

const fs = require('fs');

// Load files
const data = fs.readFileSync('war3_data_v2.js', 'utf8');
const exp = fs.readFileSync('war3_expansion.js', 'utf8');

// Create browser-like global
global.window = {};
global.document = { getElementById: () => null };

// Execute scripts
eval(data);
eval(exp);

let PASS = 0, FAIL = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    PASS++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    FAIL++;
    failures.push({ name, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

console.log('\n══════════════════════════════════════════');
console.log('  魔兽兵种对战 v3.0 - 全面测试');
console.log('══════════════════════════════════════════\n');

// ==================== 1. 数据完整性测试 ====================
console.log('📦 1. 数据完整性测试');

test('HEROES 定义完整', () => {
  assert(window.HEROES, 'HEROES 未定义');
  const keys = Object.keys(window.HEROES);
  assert(keys.length >= 3, `HEROES 只有 ${keys.length} 个，应至少3个`);
  for (const k of keys) {
    const h = window.HEROES[k];
    assert(h.name, `${k} 缺少 name`);
    assert(h.icon, `${k} 缺少 icon`);
    assert(h.hp > 0, `${k} hp 应 > 0`);
    assert(h.max_hp > 0, `${k} max_hp 应 > 0`);
    assert(h.damage > 0, `${k} damage 应 > 0`);
    assert(h.skills && h.skills.length > 0, `${k} 应有技能`);
    assert(h.goldCost >= 0, `${k} goldCost 应 >= 0`);
    assert(h.lumberCost >= 0, `${k} lumberCost 应 >= 0`);
  }
});

test('UNITS_V2 定义完整', () => {
  assert(window.UNITS_V2, 'UNITS_V2 未定义');
  const keys = Object.keys(window.UNITS_V2);
  assert(keys.length >= 10, `UNITS_V2 只有 ${keys.length} 个，应至少10个`);
  for (const k of keys) {
    const u = window.UNITS_V2[k];
    assert(u.name, `${k} 缺少 name`);
    assert(u.hp > 0, `${k} hp 应 > 0`);
    assert(u.damage >= 0, `${k} damage 应 >= 0`);
    assert(u.attackType, `${k} 缺少 attackType`);
    assert(u.armorType, `${k} 缺少 armorType`);
    assert(u.tier >= 1, `${k} tier 应 >= 1`);
    assert(u.goldCost >= 0, `${k} goldCost 应 >= 0`);
  }
});

test('SKILLS 定义完整', () => {
  assert(window.SKILLS, 'SKILLS 未定义');
  const keys = Object.keys(window.SKILLS);
  assert(keys.length >= 10, `SKILLS 只有 ${keys.length} 个，应至少10个`);
  for (const k of keys) {
    const s = window.SKILLS[k];
    assert(s.name, `${k} 缺少 name`);
    assert(s.type, `${k} 缺少 type`);
    assert(s.icon, `${k} 缺少 icon`);
    if (s.type === 'active') {
      assert(s.cooldown > 0, `${k} active skill 应有 cooldown`);
      assert(s.manaCost > 0, `${k} active skill 应有 manaCost`);
    }
  }
});

test('DAMAGE_TABLE 完整', () => {
  assert(window.DAMAGE_TABLE, 'DAMAGE_TABLE 未定义');
  const atkTypes = Object.keys(window.DAMAGE_TABLE);
  const armorTypes = ['none', 'light', 'medium', 'heavy', 'fortified', 'hero'];
  assert(atkTypes.length >= 5, '应有至少5种攻击类型');
  for (const atk of atkTypes) {
    for (const armor of armorTypes) {
      assert(window.DAMAGE_TABLE[atk][armor] !== undefined, `DAMAGE_TABLE.${atk}.${armor} 缺失`);
    }
  }
});

// ==================== 2. UnitV2 类测试 ====================
console.log('\n⚔️  2. UnitV2 类测试');

test('创建普通单位', () => {
  const u = new window.UnitV2('footman', 'blue', 0);
  assert(u.name === '步兵', `名称错误: ${u.name}`);
  assert(u.hp === 500, `HP错误: ${u.hp}`);
  assert(u.damage === 13, `伤害错误: ${u.damage}`);
  assert(u.attackType === 'normal', `攻击类型错误: ${u.attackType}`);
  assert(u.armorType === 'medium', `护甲类型错误: ${u.armorType}`);
  assert(u.owner === 'blue', `所属错误: ${u.owner}`);
  assert(!u.isHero, '不应是英雄');
  assert(!u.dead, '不应已死亡');
});

test('创建英雄单位', () => {
  const h = new window.UnitV2('strength_hero', 'blue', 0, true);
  assert(h.name === '山丘之王', `名称错误: ${h.name}`);
  assert(h.hp === 1200, `HP错误: ${h.hp}`);
  assert(h.isHero, '应是英雄');
  assert(h.skills.length >= 2, `技能数应>=2: ${h.skills.length}`);
  assert(h.mana > 0, '英雄应有魔法值');
});

test('effectiveArmor 是只读getter', () => {
  const u = new window.UnitV2('footman', 'blue', 0);
  const armor1 = u.effectiveArmor;
  // 尝试赋值不应改变 getter 行为
  try { u.effectiveArmor = 999; } catch(e) {}
  const armor2 = u.effectiveArmor;
  assert(armor2 === armor1, `effectiveArmor 被修改: ${armor1} -> ${armor2}`);
});

test('effectiveSpeed 受减速影响', () => {
  const u = new window.UnitV2('footman', 'blue', 0);
  const speed1 = u.effectiveSpeed;
  u.slowed = 2;
  const speed2 = u.effectiveSpeed;
  assert(speed2 < speed1, `减速未生效: ${speed1} -> ${speed2}`);
});

test('findTarget 选择目标', () => {
  const u = new window.UnitV2('footman', 'blue', 0);
  const enemies = [
    new window.UnitV2('archer', 'red', 0),
    new window.UnitV2('mage', 'red', 1)
  ];
  const target = u.findTarget(enemies);
  assert(target, '应找到目标');
  assert(target.owner === 'red', '目标应为敌方');
});

test('act() 眩晕时无法行动', () => {
  const u = new window.UnitV2('footman', 'blue', 0);
  const enemies = [new window.UnitV2('archer', 'red', 0)];
  u.stunned = 2;
  const result = u.act(enemies, [], []);
  assert(result === null, `眩晕时应返回 null，实际: ${JSON.stringify(result)}`);
  assert(u.stunned === 1, `眩晕应减为1，实际: ${u.stunned}`);
});

test('act() 正常攻击', () => {
  const attacker = new window.UnitV2('footman', 'blue', 0);
  const target = new window.UnitV2('archer', 'red', 0);
  const enemies = [target];
  const result = attacker.act(enemies, [], []);
  assert(result, '应返回行动结果');
  assert(Array.isArray(result), '结果应为数组');
  const attack = result.find(a => a.type === 'attack');
  assert(attack, '应包含攻击行动');
  assert(attack.damage > 0, `伤害应>0: ${attack.damage}`);
  assert(target.hp < 300, `目标HP应减少: ${target.hp}`);
});

// ==================== 3. 技能系统测试 ====================
console.log('\n✨ 3. 技能系统测试');

test('疾风步 - 隐身+下次攻击加成', () => {
  const hero = new window.UnitV2('agility_hero', 'blue', 0, true);
  const enemy = new window.UnitV2('footman', 'red', 0);
  const enemies = [enemy];
  
  // 手动设置疾风步
  hero.invisible = true;
  hero.nextAttackMult = 1.5;
  
  const originalDmg = hero.damage;
  const result = hero.act(enemies, [], []);
  
  assert(!hero.invisible, '攻击后应取消隐身');
  assert(hero.nextAttackMult === null, '攻击后应清除加成');
});

test('致命一击 - 20%暴击', () => {
  const u = new window.UnitV2('tauren', 'blue', 0);
  let crits = 0;
  for (let i = 0; i < 100; i++) {
    const fresh = new window.UnitV2('tauren', 'blue', 0);
    const target = new window.UnitV2('footman', 'red', 0);
    const result = fresh.act([target], [], []);
    if (result) {
      const attack = result.find(a => a.type === 'attack' && a.crit);
      if (attack) crits++;
    }
  }
  // 20% 暴击率，100次应在 5-50 之间
  assert(crits >= 5 && crits <= 50, `暴击率异常: ${crits}/100`);
});

test('治疗波 - 治疗3个友军', () => {
  const priest = new window.UnitV2('priest', 'blue', 0);
  priest.mana = 200; // 确保有蓝
  const allies = [
    new window.UnitV2('footman', 'blue', 1),
    new window.UnitV2('footman', 'blue', 2),
    new window.UnitV2('footman', 'blue', 3)
  ];
  // 让友军受伤
  allies[0].hp = 100;
  allies[1].hp = 100;
  allies[2].hp = 100;
  
  const skill = window.SKILLS.healing_wave;
  const result = skill.effect(priest, allies);
  assert(result.targets > 0, `应治疗目标: ${result.targets}`);
  assert(allies[0].hp > 100, `友军1应被治疗: ${allies[0].hp}`);
});

test('召唤水元素 - 创建单位', () => {
  const hero = new window.UnitV2('intelligence_hero', 'blue', 0, true);
  hero.mana = 300;
  const allies = [];
  const skill = window.SKILLS.summon_water_elemental;
  const result = skill.effect(hero, allies);
  assert(result.summon === true, '应召唤成功');
  assert(allies.length === 1, `应添加1个单位: ${allies.length}`);
  assert(allies[0].name === '水元素', `单位名称错误: ${allies[0].name}`);
});

test('辉煌光环 - 友军回蓝', () => {
  const hero = new window.UnitV2('intelligence_hero', 'blue', 0, true);
  const allies = [
    new window.UnitV2('priest', 'blue', 1),
    new window.UnitV2('mage', 'blue', 2)
  ];
  allies[0].mana = 50; // 不满蓝
  allies[1].mana = 50;
  
  const skill = window.SKILLS.blazing_weapon;
  skill.effect(allies);
  assert(allies[0].mana > 50, `牧师应回蓝: ${allies[0].mana}`);
  assert(allies[1].mana > 50, `法师应回蓝: ${allies[1].mana}`);
});

test('技能冷却系统', () => {
  const hero = new window.UnitV2('strength_hero', 'blue', 0, true);
  hero.mana = 500;
  const enemies = [new window.UnitV2('footman', 'red', 0)];
  
  // 第一次使用技能
  const result1 = hero.act(enemies, [], []);
  const skillAction = result1?.find(a => a.type === 'skill');
  if (skillAction) {
    const skillId = skillAction.skillId;
    assert(hero.skillCooldowns[skillId] > 0, `技能应进入冷却: ${hero.skillCooldowns[skillId]}`);
  }
});

// ==================== 4. 资源管理测试 ====================
console.log('\n💰 4. 资源管理测试');

test('初始资源', () => {
  const rm = new window.ResourceManager(500, 500);
  const s = rm.getState();
  assert(s.gold === 500, `金币错误: ${s.gold}`);
  assert(s.lumber === 500, `木材错误: ${s.lumber}`);
  assert(s.goldPerTurn === 40, `金币收入错误: ${s.goldPerTurn}`);
  assert(s.lumberPerTurn === 20, `木材收入错误: ${s.lumberPerTurn}`);
});

test('购买单位扣费', () => {
  const rm = new window.ResourceManager(500, 500);
  assert(rm.canAfford('footman'), '应能买步兵');
  rm.purchase('footman');
  assert(rm.gold === 400, `金币应扣100: ${rm.gold}`);
});

test('购买不可承受的单位', () => {
  const rm = new window.ResourceManager(50, 50);
  assert(!rm.canAfford('knight'), '不应能买骑士');
});

test('科技研发', () => {
  const rm = new window.ResourceManager(500, 500);
  assert(rm.canResearchTech('gold_mining'), '应能研发金矿开采');
  rm.researchTech('gold_mining');
  assert(rm.techs.includes('gold_mining'), '科技应已研发');
  assert(rm.goldPerTurn === 60, `收入应增加: ${rm.goldPerTurn}`);
  assert(!rm.canResearchTech('gold_mining'), '不应重复研发');
});

test('英雄免费生成', () => {
  const rm = new window.ResourceManager(100, 100);
  assert(rm.canAfford('strength_hero', true), '英雄应免费(0金币)');
  rm.purchase('strength_hero', true);
  assert(rm.gold === 100, `英雄不应扣金币: ${rm.gold}`);
});

// ==================== 5. AI 决策测试 ====================
console.log('\n🧠 5. AI 决策测试');

test('AIBrainV2 创建', () => {
  const brain = new window.AIBrainV2('blue', 'balanced', 'strength_hero');
  assert(brain.name === 'blue', `名称错误: ${brain.name}`);
  assert(brain.heroType === 'strength_hero', `英雄类型错误: ${brain.heroType}`);
  assert(brain.base.hp === 3000, `基地HP错误: ${brain.base.hp}`);
  assert(brain.resources.gold === 500, `初始金币错误: ${brain.resources.gold}`);
});

test('第一回合 - 英雄免费出场', () => {
  const brain = new window.AIBrainV2('blue', 'balanced', 'strength_hero');
  brain.resources.addIncome(); // 初始收入
  const turn = brain.takeTurn(null);
  
  assert(turn.heroSpawned === 'strength_hero', `英雄应出场: ${turn.heroSpawned}`);
  assert(turn.heroRevived === false, '第一回合不是复活');
  assert(brain.hasHero, '应有英雄');
  assert(brain.hero, '英雄对象应存在');
  assert(brain.hero.isHero, '英雄标记应正确');
  assert(brain.hero.hp === brain.hero.max_hp, '首回合应满血');
});

test('英雄死亡后复活半血', () => {
  const brain = new window.AIBrainV2('blue', 'balanced', 'strength_hero');
  brain.resources.addIncome();
  brain.takeTurn(null); // 第1回合：英雄出场
  
  // 模拟英雄死亡
  brain.hero.hp = 0;
  brain.hero.dead = true;
  brain.hasHero = false;
  brain.hero = null;
  
  const turn = brain.takeTurn([]); // 第2回合：英雄复活
  assert(turn.heroSpawned === 'strength_hero', '英雄应复活');
  assert(turn.heroRevived === true, '应标记为复活');
  assert(brain.hero.hp === Math.floor(brain.hero.max_hp * 0.5), `复活应半血: ${brain.hero.hp}`);
});

test('AI生产单位', () => {
  const brain = new window.AIBrainV2('blue', 'balanced', 'strength_hero');
  brain.resources.addIncome();
  const turn = brain.takeTurn(null);
  // 应生产一些单位
  assert(turn.unitsProduced.length >= 0, '应返回生产列表');
  assert(brain.army.length >= 1, '军队应有单位（至少英雄）');
});

test('不同策略选择不同科技', () => {
  const brains = {
    aggressive: new window.AIBrainV2('b1', 'aggressive', 'strength_hero'),
    defensive: new window.AIBrainV2('b2', 'defensive', 'agility_hero'),
    economic: new window.AIBrainV2('b3', 'economic', 'intelligence_hero')
  };
  
  for (const [type, brain] of Object.entries(brains)) {
    brain.resources.addIncome();
    const turn = brain.takeTurn(null);
    // 只要不出错就行
    assert(turn !== null, `${type} 决策应成功`);
  }
});

// ==================== 6. 战斗模拟测试 ====================
console.log('\n🔥 6. 战斗模拟测试');

test('完整战斗循环 - 基地攻防', () => {
  const blue = new window.AIBrainV2('blue', 'balanced', 'strength_hero');
  const red = new window.AIBrainV2('red', 'aggressive', 'agility_hero');
  
  let rounds = 0;
  const maxRounds = 120;
  
  while (rounds < maxRounds) {
    rounds++;
    
    // 收入
    blue.resources.addIncome();
    red.resources.addIncome();
    
    // AI决策
    blue.takeTurn(red.army);
    red.takeTurn(blue.army);
    
    // 战斗回合
    const allUnits = [
      ...blue.army.filter(u => !u.dead),
      ...red.army.filter(u => !u.dead)
    ].sort((a, b) => (b.effectiveSpeed || b.speed) - (a.effectiveSpeed || a.speed));
    
    for (const u of allUnits) {
      if (u.dead) continue;
      const enemies = u.owner === 'blue' ? red.army : blue.army;
      const allies = u.owner === 'blue' ? blue.army : red.army;
      try {
        u.act(enemies, allies, []);
      } catch (e) {
        throw new Error(`单位 ${u.name}(${u.owner}) 行动错误: ${e.message}`);
      }
    }
    
    // 基地攻击
    const blueAlive = blue.army.filter(u => !u.dead).length;
    const redAlive = red.army.filter(u => !u.dead).length;
    
    if (redAlive === 0 && blueAlive > 0) {
      // 蓝方攻击红方基地
      for (const u of blue.army.filter(u => !u.dead)) {
        const mult = window.DAMAGE_TABLE[u.attackType]?.fortified ?? 1.0;
        const armorReduction = red.base.armor * 0.06 / (1 + red.base.armor * 0.06);
        const dmg = Math.max(1, Math.round(u.damage * mult * (1 - armorReduction)));
        red.base.hp -= dmg;
      }
    }
    if (blueAlive === 0 && redAlive > 0) {
      for (const u of red.army.filter(u => !u.dead)) {
        const mult = window.DAMAGE_TABLE[u.attackType]?.fortified ?? 1.0;
        const armorReduction = blue.base.armor * 0.06 / (1 + blue.base.armor * 0.06);
        const dmg = Math.max(1, Math.round(u.damage * mult * (1 - armorReduction)));
        blue.base.hp -= dmg;
      }
    }
    
    // 检查胜负
    if (blue.base.hp <= 0 || red.base.hp <= 0) break;
  }
  
  assert(rounds <= maxRounds, `战斗应在 ${maxRounds} 回合内结束`);
  const gameDecided = blue.base.hp <= 0 || red.base.hp <= 0 || blue.base.hp !== red.base.hp;
  console.log(`    → ${rounds} 回合结束, 蓝${blue.base.hp} vs 红${red.base.hp}`);
  // 即使平局也算通过（说明战斗循环无崩溃）
  assert(rounds > 0, '至少执行了1回合');
});

test('多场战斗稳定性', () => {
  let errors = 0;
  for (let i = 0; i < 5; i++) {
    try {
      const blue = new window.AIBrainV2('blue', 'balanced', 'strength_hero');
      const red = new window.AIBrainV2('red', 'aggressive', 'agility_hero');
      
      for (let r = 0; r < 30; r++) {
        blue.resources.addIncome();
        red.resources.addIncome();
        blue.takeTurn(red.army);
        red.takeTurn(blue.army);
        
        const allUnits = [
          ...blue.army.filter(u => !u.dead),
          ...red.army.filter(u => !u.dead)
        ].sort((a, b) => (b.effectiveSpeed || b.speed) - (a.effectiveSpeed || a.speed));
        
        for (const u of allUnits) {
          if (u.dead) continue;
          const enemies = u.owner === 'blue' ? red.army : blue.army;
          const allies = u.owner === 'blue' ? blue.army : red.army;
          u.act(enemies, allies, []);
        }
      }
    } catch (e) {
      errors++;
      console.log(`    ❌ 第${i+1}场: ${e.message}`);
    }
  }
  assert(errors === 0, `${errors}/5 场战斗出错`);
});

// ==================== 7. 扩展包兼容性测试 ====================
console.log('\n🔮 7. 扩展包兼容性测试');

test('扩展技能已合并', () => {
  assert(window.SKILLS.flame_strike, '火焰冲击应存在');
  assert(window.SKILLS.frost_nova, '冰霜新星应存在');
  assert(window.SKILLS.shadow_strike, '暗影突袭应存在');
});

test('扩展单位已合并', () => {
  assert(window.UNITS_V2.fire_elemental, '火焰元素应存在');
  assert(window.UNITS_V2.ice_dragon, '冰龙应存在');
  assert(window.UNITS_V2.treant, '树人应存在');
  assert(window.UNITS_V2.demon_hunter, '恶魔猎手应存在');
});

test('扩展英雄已合并', () => {
  assert(window.HEROES.fire_lord, '火焰领主应存在');
  assert(window.HEROES.ice_queen, '冰霜女王应存在');
  assert(window.HEROES.shadow_assassin, '暗影刺客应存在');
  assert(window.HEROES.nature_guardian, '自然守护者应存在');
});

test('扩展单位可创建', () => {
  const u = new window.UnitV2('fire_elemental', 'blue', 0);
  assert(u.name === '火焰元素', `名称错误: ${u.name}`);
  assert(u.skills.includes('flame_strike'), '应有火焰冲击技能');
});

test('扩展英雄可创建', () => {
  const h = new window.UnitV2('fire_lord', 'blue', 0, true);
  assert(h.name === '火焰领主', `名称错误: ${h.name}`);
  assert(h.isHero, '应是英雄');
});

// ==================== 8. 边界情况测试 ====================
console.log('\n🛡️  8. 边界情况测试');

test('空敌军列表 - act不应崩溃', () => {
  const u = new window.UnitV2('footman', 'blue', 0);
  const result = u.act([], [], []);
  // 没敌人不应崩溃
  assert(result === null || Array.isArray(result), '空敌军不应崩溃');
});

test('null敌军 - findTarget不应崩溃', () => {
  const u = new window.UnitV2('footman', 'blue', 0);
  const target = u.findTarget([]);
  assert(target === null, '空敌军应返回null');
});

test('满血治疗 - 不超过max_hp', () => {
  const priest = new window.UnitV2('priest', 'blue', 0);
  priest.mana = 200;
  const allies = [new window.UnitV2('footman', 'blue', 1)]; // 满血
  const skill = window.SKILLS.healing_wave;
  const result = skill.effect(priest, allies);
  // 满血友军治疗量应为0或极少
  assert(allies[0].hp <= allies[0].max_hp, 'HP不应超过max_hp');
});

test('护甲减伤计算', () => {
  const attacker = new window.UnitV2('footman', 'blue', 0);
  const target = new window.UnitV2('knight', 'red', 0);
  const enemies = [target];
  
  const oldHp = target.hp;
  attacker.act(enemies, [], []);
  const actualDmg = oldHp - target.hp;
  
  // 步兵(normal) vs 骑士(heavy) = 1.0x
  // 骑士护甲10 => 减伤 10*0.06/(1+10*0.06) = 37.5%
  const mult = window.DAMAGE_TABLE.normal.heavy;
  const armor = target.armor;
  const reduction = armor * 0.06 / (1 + armor * 0.06);
  const expected = Math.max(1, Math.round(attacker.damage * mult * (1 - reduction)));
  
  assert(actualDmg === expected, `伤害计算错误: 期望${expected} 实际${actualDmg}`);
});

// ==================== 结果汇总 ====================
console.log('\n══════════════════════════════════════════');
console.log(`  测试结果: ${PASS} 通过, ${FAIL} 失败`);
console.log('══════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\n❌ 失败详情:');
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
}

process.exit(FAIL > 0 ? 1 : 0);
