const ROLE_DATA = [
  { id: "hero", name: "勇者", icon: "🗡️", skill: "勇者の一撃", description: "この攻撃に +3 ダメージ" },
  { id: "warrior", name: "戦士", icon: "🛡️", skill: "鉄壁の構え", description: "次の被ダメージを 4 軽減" },
  { id: "mage", name: "魔法使い", icon: "🔮", skill: "魔力増幅", description: "この攻撃のダメージを2倍" },
  { id: "priest", name: "僧侶", icon: "✨", skill: "癒やしの祈り", description: "仲間全員を 5 回復" }
];

const OFFICIAL_TECHNIQUES = [
  { id: "preset-1", category: "ボール", difficulty: 1, name: "カスケード", condition: "ボール3個で連続10キャッチする" },
  { id: "preset-2", category: "ボール", difficulty: 3, name: "リバースカスケード", condition: "逆回転で連続5キャッチする" },
  { id: "preset-3", category: "クラブ", difficulty: 3, name: "クラブ・カスケード", condition: "クラブ3本で連続5キャッチする" },
  { id: "preset-4", category: "リング", difficulty: 2, name: "リング・フラッシュ", condition: "リング3枚を投げてすべてキャッチする" },
  { id: "preset-5", category: "ディアボロ", difficulty: 4, name: "ハイトス", condition: "ディアボロを高く投げてキャッチする" },
  { id: "preset-6", category: "その他", difficulty: 2, name: "自由演技", condition: "道具を使った演技を5秒間続ける" }
];

const ENEMY_POOLS = [
  [
    { name: "迷子のスライム", icon: "🫧", maxHp: 18, attack: 4, weakness: "hero", skill: "ぷるぷる波", cooldown: 3, bonus: 3, category: "ボール", reward: 10 },
    { name: "森のいたずらコボルト", icon: "🐺", maxHp: 22, attack: 5, weakness: "warrior", skill: "木の実連射", cooldown: 3, bonus: 3, category: "クラブ", reward: 12 },
    { name: "空飛ぶ小鬼", icon: "👺", maxHp: 20, attack: 4, weakness: "mage", skill: "つむじ風", cooldown: 2, bonus: 4, category: "リング", reward: 11 }
  ],
  [
    { name: "洞窟のガーゴイル", icon: "🪨", maxHp: 32, attack: 6, weakness: "mage", skill: "石化の視線", cooldown: 3, bonus: 5, category: "クラブ", reward: 19 },
    { name: "深森の大トカゲ", icon: "🦎", maxHp: 36, attack: 6, weakness: "priest", skill: "灼熱の息", cooldown: 2, bonus: 5, category: "ボール", reward: 21 },
    { name: "遺跡の番兵", icon: "🤖", maxHp: 38, attack: 7, weakness: "hero", skill: "重力波", cooldown: 3, bonus: 6, category: "ディアボロ", reward: 23 }
  ],
  [
    { name: "終幕のドラゴン", icon: "🐉", maxHp: 58, attack: 8, weakness: "warrior", skill: "竜の大咆哮", cooldown: 2, bonus: 8, category: "ボール", reward: 50, boss: true }
  ]
];

const NODE_DATA = {
  battle: { name: "戦闘", icon: "⚔️", detail: "敵に挑戦してゴールドを獲得" },
  rest: { name: "休憩所", icon: "🔥", detail: "仲間全員のHPを回復" },
  shop: { name: "旅の商人", icon: "🧪", detail: "ゴールドで回復アイテムを購入" },
  event: { name: "不思議な出会い", icon: "❔", detail: "ランダムな幸運に遭遇" }
};

const STORAGE_KEYS = { techniques: "juggle-quest-techniques-v1" };
const app = document.getElementById("app");
let screen = "game";
let game = null;
let techniques = loadTechniques();
let toastTimer = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function loadTechniques() {
  const saved = localStorage.getItem(STORAGE_KEYS.techniques);
  if (!saved) return OFFICIAL_TECHNIQUES.map(technique => ({ ...technique }));
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isValidTechnique)) {
      throw new Error("保存された技リストの形式が正しくありません。");
    }
    return parsed;
  } catch (error) {
    showToast(`技リストを読み込めませんでした: ${error.message}`, true);
    return OFFICIAL_TECHNIQUES.map(technique => ({ ...technique }));
  }
}

function isValidTechnique(item) {
  return item && typeof item.id === "string" && typeof item.name === "string"
    && typeof item.category === "string" && typeof item.condition === "string"
    && Number.isInteger(item.difficulty) && item.difficulty >= 1 && item.difficulty <= 7;
}

function saveTechniques() {
  localStorage.setItem(STORAGE_KEYS.techniques, JSON.stringify(techniques));
}

function showToast(message, isError = false) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  clearTimeout(toastTimer);
  const element = document.createElement("div");
  element.className = `toast${isError ? " error" : ""}`;
  element.setAttribute("role", isError ? "alert" : "status");
  element.textContent = message;
  document.body.append(element);
  toastTimer = setTimeout(() => element.remove(), 3600);
}

function createRoute() {
  return [
    ["battle", "battle", "battle"],
    ["rest", "shop", "event"],
    ["battle", "battle", "battle"],
    ["rest", "shop", "event"],
    ["battle", "battle", "battle"]
  ];
}

function startGame() {
  game = {
    party: ROLE_DATA.map(role => ({ ...role, hp: 20, maxHp: 20, exhausted: false, skillUsed: false, guard: 0 })),
    gold: 20,
    route: createRoute(),
    stage: 0,
    phase: "route",
    enemy: null,
    challenge: null,
    log: [],
    outcome: null,
    attackBonus: 0
  };
  render();
}

function chooseEnemy(stage) {
  const pool = ENEMY_POOLS[stage === 4 ? 2 : stage === 2 ? 1 : 0];
  const enemy = { ...pool[Math.floor(Math.random() * pool.length)] };
  return { ...enemy, hp: enemy.maxHp, cooldownLeft: enemy.cooldown };
}

function getTechniqueFor(enemy) {
  const matching = techniques.filter(technique => technique.category === enemy.category);
  const options = matching.length ? matching : techniques;
  if (options.length) return { ...options[Math.floor(Math.random() * options.length)], substitute: matching.length === 0 };
  return {
    id: "generic-challenge",
    category: "フリースタイル",
    difficulty: 1,
    name: "自由なジャグリング",
    condition: "安全にできるジャグリングを5秒間続ける",
    substitute: true
  };
}

function roleById(id) {
  return ROLE_DATA.find(role => role.id === id);
}

function getAvailableParty() {
  return game.party.filter(member => member.hp > 0 && !member.exhausted);
}

function renderHeader() {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">✳</div>
        <div><h1>JUGGLE QUEST</h1><p>ジャグリング × ローグライクRPG</p></div>
      </div>
      <nav class="top-actions" aria-label="メインメニュー">
        <button class="nav-btn ${screen === "game" ? "active" : ""}" data-action="screen-game">遠征</button>
        <button class="nav-btn ${screen === "techniques" ? "active" : ""}" data-action="screen-techniques">技リスト <span>(${techniques.length})</span></button>
      </nav>
    </header>`;
}

function renderParty(showExhaustion = false) {
  const members = game ? game.party : ROLE_DATA.map(role => ({ ...role, hp: 20, maxHp: 20, skillUsed: false, exhausted: false }));
  return `
    <div class="party-list">
      ${members.map(member => {
        const role = roleById(member.id);
        const hpPercent = Math.max(0, member.hp / member.maxHp * 100);
        return `
          <article class="party-member">
            <div class="member-top">
              <div class="member-icon" aria-hidden="true">${role.icon}</div>
              <div class="member-meta"><strong>${role.name}</strong><small>${member.hp <= 0 ? "戦闘不能" : showExhaustion && member.exhausted ? "次のターン行動不可" : role.skill}</small></div>
            </div>
            <div class="hp-line"><span>HP</span><span>${member.hp} / ${member.maxHp}</span></div>
            <div class="hp-track"><div class="hp-fill${hpPercent <= 30 ? " low" : ""}" style="width:${hpPercent}%"></div></div>
            <span class="skill-chip${member.skillUsed ? " used" : ""}">${member.skillUsed ? "使用済み" : `✦ ${role.description}`}</span>
          </article>`;
      }).join("")}
    </div>`;
}

function renderIntro() {
  return `
    <section class="intro card">
      <div class="intro-content">
        <div class="eyebrow">A CO-OP JUGGLING ADVENTURE</div>
        <h2>技を決めて、仲間と<br>最奥のドラゴンへ。</h2>
        <p>現実のジャグリングが冒険の力になる。仲間と役割を分担し、判定員のジャッジで道を切りひらこう。</p>
        <div class="pill-row"><span class="pill">4つの役職</span><span class="pill">全3戦の遠征</span><span class="pill">判定員入力</span><span class="pill">技リスト編集</span></div>
        <div style="margin-top:20px"><button class="button primary" data-action="start-game">遠征をはじめる <span aria-hidden="true">→</span></button></div>
      </div>
    </section>`;
}

function renderRouteMap() {
  const stages = ["第一の試練", "分かれ道", "第二の試練", "旅の準備", "最終決戦"];
  return `
    <section class="card map-card">
      <div class="section-heading">
        <div><h2>冒険のルート</h2><p>ノードを選んで次の行き先を決めよう</p></div>
        <span class="pill">${game.stage}/5 到達</span>
      </div>
      <div class="route-map">
        ${game.route.map((nodes, stageIndex) => `
          <div class="route-stage">
            <p class="stage-label">${stages[stageIndex]}</p>
            ${nodes.map((type, nodeIndex) => {
              const node = NODE_DATA[type];
              const past = stageIndex < game.stage;
              const current = stageIndex === game.stage && game.phase === "route";
              const selected = past && game.route[stageIndex][game.selectedNodes?.[stageIndex]] === type && game.selectedNodes?.[stageIndex] === nodeIndex;
              const locked = !current;
              return `<button class="route-node${selected ? " selected" : ""}${locked ? " locked" : ""}" data-action="choose-node" data-stage="${stageIndex}" data-node="${nodeIndex}" ${locked ? "disabled" : ""}>
                <span class="node-icon" aria-hidden="true">${past && !selected ? "✓" : node.icon}</span>
                <strong>${past && !selected ? "通過済み" : node.name}</strong>
                <small>${current ? node.detail : stageIndex > game.stage ? "未踏のルート" : selected ? "選択したルート" : ""}</small>
              </button>`;
            }).join("")}
          </div>`).join("")}
      </div>
      <p class="map-note">必須戦闘 3 回を突破すると、最終決戦でドラゴンが待ち受けています。</p>
    </section>`;
}

function renderPartyCard() {
  return `
    <aside class="card party-card">
      <div class="section-heading"><div><h2>パーティー</h2><p>一度使った役職は次のターン休み</p></div></div>
      <div class="party-stats"><span>所持ゴールド</span><strong>🪙 ${game.gold}</strong></div>
      ${renderParty(true)}
    </aside>`;
}

function renderGame() {
  if (!game) {
    return `${renderIntro()}
      <div class="map-layout">
        <section class="card map-card">
          <div class="section-heading"><div><h2>遠征の流れ</h2><p>全5区間を進み、3回の戦闘を突破しよう</p></div></div>
          <div class="route-map">
            ${["第一の試練", "分かれ道", "第二の試練", "旅の準備", "最終決戦"].map((label, index) => {
              const types = index === 0 || index === 2 || index === 4 ? ["battle"] : ["rest", "shop", "event"];
              return `<div class="route-stage"><p class="stage-label">${label}</p>${types.map(type => `<div class="route-node locked"><span class="node-icon">${NODE_DATA[type].icon}</span><strong>${NODE_DATA[type].name}</strong><small>${NODE_DATA[type].detail}</small></div>`).join("")}</div>`;
            }).join("")}
          </div>
        </section>
        <aside class="card party-card">
          <div class="section-heading"><div><h2>冒険の仲間</h2><p>それぞれ一度だけ使える特殊スキル</p></div></div>
          ${renderParty(false)}
        </aside>
      </div>`;
  }
  if (game.outcome) return renderEndScreen();
  if (game.phase === "battle") return renderBattle();
  if (game.phase === "route") {
    return `
      <div class="page-heading">
        <div><div class="eyebrow">EXPEDITION · ${game.stage + 1} / 5</div><h2 class="page-title">次の行き先を選ぼう</h2><p class="page-subtitle">${game.stage === 0 || game.stage === 2 || game.stage === 4 ? "この区間は必須戦闘。パーティーの力を合わせて突破しよう。" : "休憩・買い物・イベントから、パーティーに必要な道を選ぼう。"}</p></div>
        <button class="button small" data-action="new-game">遠征をやり直す</button>
      </div>
      <div class="map-layout">${renderRouteMap()}${renderPartyCard()}</div>`;
  }
  if (game.phase === "node-result") return renderNodeResult();
  return renderEndScreen();
}

function renderBattle() {
  const enemy = game.enemy;
  const challenge = game.challenge;
  const alive = game.party.filter(member => member.hp > 0);
  if (getAvailableParty().length < 2 && alive.length >= 2 && !challenge) {
    game.party.forEach(member => { member.exhausted = false; });
  }
  const available = getAvailableParty();
  const weaknessRole = roleById(enemy.weakness);
  const isBoss = Boolean(enemy.boss);
  return `
    <div class="page-heading">
      <div><div class="eyebrow">${isBoss ? "FINAL BATTLE" : `BATTLE · ${game.stage === 2 ? "第2戦" : "第1戦"}`}</div><h2 class="page-title">${isBoss ? "最終決戦" : "戦闘中"}</h2><p class="page-subtitle">攻撃役と防御役は別々に選択。判定員が技の成功と難易度を入力してください。</p></div>
      <button class="button small" data-action="new-game">遠征をやり直す</button>
    </div>
    <div class="combat-layout">
      <div class="combat-main">
        <section class="card arena">
          <div class="arena-content">
            <div class="arena-top"><div><div class="eyebrow">${isBoss ? "THE LAST CHALLENGE" : "ENCOUNTER"}</div><h2 class="enemy-name">${escapeHtml(enemy.name)}</h2></div><div class="enemy-art" aria-label="${escapeHtml(enemy.name)}">${enemy.icon}</div></div>
            <div class="enemy-details">
              <div class="enemy-hp-text"><span>ENEMY HP</span><strong>${enemy.hp} / ${enemy.maxHp}</strong></div>
              <div class="hp-track"><div class="hp-fill${enemy.hp / enemy.maxHp <= .3 ? " low" : ""}" style="width:${Math.max(0, enemy.hp / enemy.maxHp * 100)}%"></div></div>
              <div class="enemy-tags"><span class="tag weakness">弱点：${weaknessRole.name}</span><span class="tag">攻撃力 ${enemy.attack}</span></div>
              <div class="cooldown">✦ ${escapeHtml(enemy.skill)} 発動まで <strong>${enemy.cooldownLeft}</strong> ターン</div>
            </div>
          </div>
        </section>
        ${challenge ? renderDefenseForm(challenge, available) : renderAttackForm(available)}
        <section class="card log-card">
          <div class="section-heading"><div><h3>戦闘ログ</h3></div><span class="pill">新しい順</span></div>
          <ul class="battle-log">${game.log.map(entry => `<li>${escapeHtml(entry)}</li>`).join("") || "<li>戦闘開始。攻撃する仲間を選んでください。</li>"}</ul>
        </section>
      </div>
      <aside class="card party-card"><div class="section-heading"><div><h2>パーティー</h2><p>現在のHPと行動状態</p></div><span class="pill">${available.length}人行動可能</span></div>${renderParty(true)}</aside>
    </div>`;
}

function renderAttackForm(available) {
  const options = available.map(member => `<option value="${member.id}">${member.name}</option>`).join("");
  const initialAttacker = available[0];
  const initialSkill = initialAttacker && !initialAttacker.skillUsed
    ? `<option value="${initialAttacker.id}">${initialAttacker.name}：${initialAttacker.description}</option>`
    : "";
  return `
    <section class="card battle-card">
      <div class="section-heading"><div><h2>プレイヤーの攻撃</h2><p>ジャグリングを披露した後、判定を入力</p></div></div>
      <form class="battle-form" data-form="attack">
        <div class="form-row">
          <div class="field"><label for="attacker">攻撃するプレイヤー</label><select id="attacker" name="attacker" required>${options}</select></div>
          <div class="field"><label for="difficulty">判定員：難易度（0〜10）</label><input id="difficulty" name="difficulty" type="number" min="0" max="10" step="1" value="5" required></div>
        </div>
        <label class="check-row"><input name="success" type="checkbox" checked> 技に成功した（失敗時はダメージ0）</label>
        <div class="field"><span class="field-label">攻撃効果</span><div id="attack-preview" class="notice">弱点役職の攻撃はダメージ2倍。役職スキルは各遠征1回。</div></div>
        <div class="field"><label for="skill">攻撃役の特殊スキル（任意・各遠征1回）</label><select id="skill" name="skill"><option value="none">使用しない</option>${initialSkill}</select></div>
        <button class="button primary" type="submit">攻撃を確定 <span aria-hidden="true">→</span></button>
      </form>
    </section>`;
}

function renderDefenseForm(challenge, available) {
  const candidates = available.filter(member => member.hp > 0);
  return `
    <section class="card battle-card">
      <div class="section-heading"><div><h2>敵の課題に挑戦</h2><p>成功すれば敵の攻撃を防げます</p></div><span class="pill">判定入力</span></div>
      <div class="hint-card"><div class="hint-title">📜 モンスターからの課題</div><h3>${escapeHtml(challenge.name)} <span class="pill">難易度 ${challenge.difficulty}</span></h3><p>${escapeHtml(challenge.condition)}</p>${challenge.substitute ? '<p style="color:#efbd65">指定道具の技がないため、登録技から代替しています。</p>' : ""}</div>
      <form class="battle-form" data-form="defense" style="margin-top:14px">
        <div class="field"><label for="defender">防御するプレイヤー（攻撃役以外）</label><select id="defender" name="defender" required>${candidates.map(member => `<option value="${member.id}">${member.name}</option>`).join("")}</select></div>
        <label class="check-row"><input name="success" type="checkbox"> 課題に成功した（成功でダメージを防ぐ）</label>
        <button class="button primary" type="submit">防御判定を確定 <span aria-hidden="true">→</span></button>
      </form>
    </section>`;
}

function renderNodeResult() {
  const result = game.nodeResult;
  return `
    <div class="page-heading"><div><div class="eyebrow">ROUTE EVENT</div><h2 class="page-title">${escapeHtml(result.title)}</h2><p class="page-subtitle">${escapeHtml(result.description)}</p></div></div>
    <div class="map-layout">
      <section class="card battle-card">
        <div class="result-banner">${escapeHtml(result.message)}</div>
        ${result.shop ? `<div style="margin-top:17px"><div class="section-heading"><div><h2>旅の商人</h2><p>所持ゴールド：🪙 ${game.gold}</p></div></div><div class="pill-row">${[0,1,2,3].map(index => `<button class="button small" data-action="buy-potion" data-index="${index}">回復薬 ${[10,20,30,40][index]}G（全員+${[3,6,10,15][index]}HP）</button>`).join("")}</div></div>` : ""}
        <div style="margin-top:18px"><button class="button primary" data-action="continue-route">ルートに戻る →</button></div>
      </section>
      ${renderPartyCard()}
    </div>`;
}

function renderEndScreen() {
  const won = game.outcome === "won";
  return `
    <section class="intro card">
      <div class="intro-content">
        <div class="eyebrow">${won ? "QUEST COMPLETE" : "EXPEDITION OVER"}</div>
        <h2>${won ? "ドラゴン討伐成功！" : "遠征失敗…"}</h2>
        <p>${won ? `仲間と技をつなぎ、最奥のドラゴンを倒した！最終獲得ゴールド：${game.gold}G` : "仲間のHPが尽きてしまった。技リストを整えて、もう一度挑戦しよう。"}</p>
        <button class="button primary" data-action="new-game">もう一度遠征する →</button>
      </div>
    </section>
    <div class="map-layout">
      <section class="card map-card"><div class="section-heading"><div><h2>${won ? "英雄たちの記録" : "今回のパーティー"}</h2><p>遠征での仲間の状態</p></div></div>${renderParty(true)}</section>
      <aside class="card party-card"><div class="section-heading"><div><h2>次の挑戦へ</h2><p>技リストはいつでも編集できます</p></div></div><button class="button" data-action="screen-techniques">技リストを編集</button></aside>
    </div>`;
}

function categoryIcon(category) {
  return ({ "ボール": "🔴", "クラブ": "🏏", "リング": "⭕", "ディアボロ": "🪀", "その他": "✨" })[category] || "🤹";
}

function renderTechniques() {
  return `
    <div class="page-heading">
      <div><div class="eyebrow">JUGGLING TECHNIQUES</div><h2 class="page-title">技リスト</h2><p class="page-subtitle">技を登録すると、敵の課題として出題されます。道具のジャンルに合う技がない場合は登録技から代替します。</p></div>
      <button class="button primary" data-action="add-technique">＋ 技を追加</button>
    </div>
    <section class="card map-card">
      <div class="section-heading">
        <div><h2>登録済みの技 <span class="pill">${techniques.length} 件</span></h2><p>このブラウザーに自動保存されます</p></div>
        <div class="tech-toolbar">
          <button class="button small" data-action="load-presets">公式プリセットを読み込む</button>
          <button class="button small" data-action="export-techniques">書き出し</button>
          <label class="button small" for="import-file">読み込み</label>
          <input id="import-file" type="file" accept="application/json,.json" hidden>
        </div>
      </div>
      <div class="notice" style="margin-bottom:15px">難易度は1〜7。バトル中の判定員入力は0〜10です。公式プリセットを読み込むと、現在の技リストに追加されます。</div>
      ${techniques.length ? `<div class="tech-grid">${techniques.map(technique => `
        <article class="tech-item">
          <div class="tech-symbol" aria-hidden="true">${categoryIcon(technique.category)}</div>
          <div class="tech-info"><h3>${escapeHtml(technique.name)}</h3><p>${escapeHtml(technique.condition)}</p><div class="tech-meta"><span class="pill">${escapeHtml(technique.category)}</span><span class="pill">難易度 ${technique.difficulty}</span></div></div>
          <div class="tech-actions"><button class="button small" data-action="edit-technique" data-id="${escapeHtml(technique.id)}" aria-label="${escapeHtml(technique.name)}を編集">編集</button><button class="button small danger" data-action="delete-technique" data-id="${escapeHtml(technique.id)}" aria-label="${escapeHtml(technique.name)}を削除">削除</button></div>
        </article>`).join("")}</div>` : '<div class="empty-state">技が登録されていません。技を追加するか、公式プリセットを読み込んでください。</div>'}
    </section>`;
}

function render() {
  app.innerHTML = `<div class="shell">${renderHeader()}<main>${screen === "techniques" ? renderTechniques() : renderGame()}</main></div>`;
}

function addLog(message) {
  game.log.unshift(message);
  game.log = game.log.slice(0, 8);
}

function handleNodeSelection(index) {
  if (!game || game.phase !== "route") return;
  const type = game.route[game.stage][index];
  game.selectedNodes ||= [];
  game.selectedNodes[game.stage] = index;
  if (type === "battle") {
    game.enemy = chooseEnemy(game.stage);
    game.challenge = null;
    game.log = [`${game.enemy.name}が現れた！`];
    game.phase = "battle";
  } else {
    game.phase = "node-result";
    if (type === "rest") {
      game.party.forEach(member => { member.hp = Math.min(member.maxHp, member.hp + 6); });
      game.nodeResult = { title: "焚き火の休憩所", description: "仲間と一緒にひと休み。", message: "仲間全員のHPを6回復しました。" };
    } else if (type === "shop") {
      game.nodeResult = { title: "旅の商人", description: "遠征で手に入れたゴールドで、回復薬を購入できます。", message: "薬の購入は任意です。購入後もゴールドが残れば、ルートに戻れます。", shop: true };
    } else {
      const events = [
        { title: "道端の祝福", description: "旅の祈りがパーティーを包む。", message: "仲間全員のHPを4回復しました。", effect: () => game.party.forEach(member => { member.hp = Math.min(member.maxHp, member.hp + 4); }) },
        { title: "落とし物の財布", description: "道端で小さな財布を見つけた。", message: "ゴールドを15獲得しました。", effect: () => { game.gold += 15; } },
        { title: "技のひらめき", description: "新しい技のコツをつかんだ。", message: "次の攻撃が成功したとき、追加で3ダメージを与えます。", effect: () => { game.attackBonus += 3; } }
      ];
      const event = events[Math.floor(Math.random() * events.length)];
      event.effect();
      game.nodeResult = { title: event.title, description: event.description, message: event.message };
    }
  }
  render();
}

function useSkill(roleId) {
  const member = game.party.find(item => item.id === roleId);
  member.skillUsed = true;
  if (roleId === "warrior") member.guard = 4;
  if (roleId === "priest") {
    game.party.forEach(ally => { ally.hp = Math.min(ally.maxHp, ally.hp + 5); });
  }
}

function resolveAttack(form) {
  const data = new FormData(form);
  let available = getAvailableParty();
  if (available.length < 2 && game.party.filter(member => member.hp > 0).length >= 2) {
    game.party.forEach(member => { member.exhausted = false; });
    available = getAvailableParty();
  }
  const attacker = game.party.find(member => member.id === data.get("attacker"));
  if (!attacker || attacker.hp <= 0 || attacker.exhausted) {
    showToast("そのプレイヤーは現在攻撃できません。", true);
    return;
  }
  const difficulty = Number(data.get("difficulty"));
  if (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 10) {
    showToast("難易度は0〜10の整数で入力してください。", true);
    return;
  }
  const success = data.get("success") === "on";
  const skillId = data.get("skill");
  const skill = skillId === attacker.id && !attacker.skillUsed;
  const usedSkillRole = skill ? skillId : null;
  if (usedSkillRole) useSkill(usedSkillRole);
  const baseDamage = success ? difficulty + game.attackBonus : 0;
  let multiplier = attacker.id === game.enemy.weakness ? 2 : 1;
  if (usedSkillRole === "mage") multiplier *= 2;
  let damage = success ? baseDamage * multiplier : 0;
  if (usedSkillRole === "hero" && success) damage += 3;
  if (usedSkillRole === "warrior" && success) damage += 2;
  if (usedSkillRole === "priest") damage = 0;
  if (success) game.attackBonus = 0;
  game.enemy.hp = Math.max(0, game.enemy.hp - damage);
  attacker.exhausted = true;
  const resultText = success ? `${damage}ダメージ` : "失敗、ダメージなし";
  addLog(`${attacker.name}の攻撃：${resultText}${attacker.id === game.enemy.weakness && success ? "（弱点を突いた！）" : ""}`);
  if (usedSkillRole) addLog(`${roleById(usedSkillRole).name}が「${roleById(usedSkillRole).skill}」を使用。`);
  if (game.enemy.hp <= 0) {
    finishBattle(true);
    return;
  }
  game.challenge = getTechniqueFor(game.enemy);
  game.challenge.attackerId = attacker.id;
  render();
}

function resolveDefense(form) {
  const data = new FormData(form);
  const defender = game.party.find(member => member.id === data.get("defender"));
  const attackerId = game.challenge.attackerId;
  if (!defender || defender.hp <= 0 || defender.exhausted || defender.id === attackerId) {
    showToast("防御役を選び直してください。", true);
    return;
  }
  const succeeded = data.get("success") === "on";
  defender.exhausted = true;
  const enemy = game.enemy;
  enemy.cooldownLeft -= 1;
  let incomingDamage = 0;
  const skillReady = enemy.cooldownLeft <= 0;
  if (!succeeded) {
    incomingDamage = enemy.attack + (skillReady ? enemy.bonus : 0);
    incomingDamage = Math.max(0, incomingDamage - defender.guard);
    defender.guard = 0;
    defender.hp = Math.max(0, defender.hp - incomingDamage);
    addLog(`${defender.name}は課題に失敗。${incomingDamage}ダメージを受けた。`);
  } else {
    defender.guard = 0;
    addLog(`${defender.name}が課題に成功。敵の攻撃を防いだ！`);
  }
  if (skillReady) {
    addLog(`${enemy.name}の特殊スキル「${enemy.skill}」が発動！`);
    enemy.cooldownLeft = enemy.cooldown;
  }
  game.challenge = null;
  if (game.party.every(member => member.hp <= 0)) {
    game.outcome = "lost";
    render();
    return;
  }
  render();
}

function finishBattle(won) {
  if (won) {
    game.gold += game.enemy.reward;
    game.party.forEach(member => { member.exhausted = false; });
    if (game.stage === 4) {
      game.outcome = "won";
    } else {
      game.stage += 1;
      game.phase = "route";
    }
    showToast(`${game.enemy.name}を撃破！ ${game.enemy.reward}Gを獲得しました。`);
  } else {
    game.outcome = "lost";
  }
  game.enemy = null;
  game.challenge = null;
  render();
}

function makeTechniqueForm(technique = null) {
  const editing = Boolean(technique);
  const categories = ["ボール", "クラブ", "リング", "ディアボロ", "その他"];
  const safe = technique || { name: "", category: "ボール", difficulty: 1, condition: "" };
  app.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" data-action="close-modal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${editing ? "技を編集" : "技を追加"}</h2>
        <p>ジャグリングの道具・難易度・成功条件を登録します。</p>
        <form class="modal-form" data-form="technique">
          <input type="hidden" name="id" value="${escapeHtml(safe.id || "")}">
          <div class="form-row">
            <div class="field"><label for="tech-category">ジャンル（道具）</label><select id="tech-category" name="category">${categories.map(category => `<option${category === safe.category ? " selected" : ""}>${category}</option>`).join("")}</select></div>
            <div class="field"><label for="tech-difficulty">難易度（1〜7）</label><input id="tech-difficulty" name="difficulty" type="number" min="1" max="7" value="${safe.difficulty}" required></div>
          </div>
          <div class="field"><label for="tech-name">技名</label><input id="tech-name" name="name" maxlength="60" value="${escapeHtml(safe.name)}" required></div>
          <div class="field"><label for="tech-condition">成功条件</label><input id="tech-condition" name="condition" maxlength="200" value="${escapeHtml(safe.condition)}" required></div>
          <div class="modal-actions"><button class="button" type="button" data-action="close-modal">キャンセル</button><button class="button primary" type="submit">保存する</button></div>
        </form>
      </section>
    </div>`);
  document.getElementById("tech-name").focus();
}

function exportTechniques() {
  const blob = new Blob([JSON.stringify(techniques, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "juggle-quest-techniques.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("技リストをJSON形式で書き出しました。");
}

async function importTechniques(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed) || !parsed.every(isValidTechnique)) {
      throw new Error("各技に技名・ジャンル・難易度（1〜7）・成功条件が必要です。");
    }
    techniques = parsed.map(item => ({ ...item, id: crypto.randomUUID() }));
    saveTechniques();
    render();
    showToast(`${techniques.length}件の技を読み込みました。`);
  } catch (error) {
    showToast(`ファイルを読み込めませんでした: ${error.message}`, true);
  }
}

app.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "screen-game") { screen = "game"; render(); }
  if (action === "screen-techniques") { screen = "techniques"; render(); }
  if (action === "start-game" || action === "new-game") startGame();
  if (action === "choose-node") handleNodeSelection(Number(button.dataset.node));
  if (action === "continue-route") {
    game.phase = "route";
    game.stage += 1;
    if (game.stage >= game.route.length) game.outcome = "won";
    render();
  }
  if (action === "buy-potion") {
    const index = Number(button.dataset.index);
    const prices = [10, 20, 30, 40];
    const healing = [3, 6, 10, 15];
    if (game.gold < prices[index]) {
      showToast("ゴールドが足りません。", true);
    } else {
      game.gold -= prices[index];
      game.party.forEach(member => { member.hp = Math.min(member.maxHp, member.hp + healing[index]); });
      game.nodeResult.message = `回復薬を購入。仲間全員のHPを${healing[index]}回復しました。`;
      render();
      showToast("回復薬を購入しました。");
    }
  }
  if (action === "add-technique") makeTechniqueForm();
  if (action === "edit-technique") {
    const technique = techniques.find(item => item.id === button.dataset.id);
    if (technique) makeTechniqueForm(technique);
  }
  if (action === "delete-technique") {
    const technique = techniques.find(item => item.id === button.dataset.id);
    if (technique && window.confirm(`「${technique.name}」を削除しますか？`)) {
      techniques = techniques.filter(item => item.id !== technique.id);
      saveTechniques();
      render();
      showToast("技を削除しました。");
    }
  }
  if (action === "load-presets") {
    const present = new Set(techniques.map(item => `${item.category}:${item.name}`));
    const additions = OFFICIAL_TECHNIQUES.filter(item => !present.has(`${item.category}:${item.name}`))
      .map(item => ({ ...item, id: crypto.randomUUID() }));
    techniques = [...techniques, ...additions];
    saveTechniques();
    render();
    showToast(additions.length ? `${additions.length}件の公式技を追加しました。` : "公式プリセットはすべて登録済みです。");
  }
  if (action === "export-techniques") exportTechniques();
  if (action === "close-modal" && (button === event.target || button.tagName === "BUTTON")) {
    document.querySelector(".modal-backdrop")?.remove();
  }
});

app.addEventListener("submit", event => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === "attack") resolveAttack(form);
  if (form.dataset.form === "defense") resolveDefense(form);
  if (form.dataset.form === "technique") {
    const data = new FormData(form);
    const technique = {
      id: data.get("id") || crypto.randomUUID(),
      category: String(data.get("category")),
      difficulty: Number(data.get("difficulty")),
      name: String(data.get("name")).trim(),
      condition: String(data.get("condition")).trim()
    };
    if (!isValidTechnique(technique) || !technique.name || !technique.condition) {
      showToast("各項目を入力し、難易度を1〜7にしてください。", true);
      return;
    }
    const existingIndex = techniques.findIndex(item => item.id === technique.id);
    if (existingIndex >= 0) techniques[existingIndex] = technique;
    else techniques.push(technique);
    saveTechniques();
    document.querySelector(".modal-backdrop")?.remove();
    render();
    showToast("技リストを保存しました。");
  }
});

app.addEventListener("change", event => {
  if (event.target.id === "import-file" && event.target.files?.[0]) importTechniques(event.target.files[0]);
  if (event.target.id === "attacker" || event.target.id === "difficulty" || event.target.id === "skill") {
    const preview = document.getElementById("attack-preview");
    const form = document.querySelector('form[data-form="attack"]');
    if (!preview || !form || !game?.enemy) return;
    if (event.target.id === "attacker") {
      const attacker = game.party.find(member => member.id === event.target.value);
      const skillSelect = form.elements.namedItem("skill");
      skillSelect.innerHTML = `<option value="none">使用しない</option>${attacker && !attacker.skillUsed ? `<option value="${attacker.id}">${attacker.name}：${attacker.description}</option>` : ""}`;
    }
    const data = new FormData(form);
    const attacker = game.party.find(member => member.id === data.get("attacker"));
    const skillId = data.get("skill");
    const isWeak = attacker?.id === game.enemy.weakness;
    const selectedSkill = roleById(skillId);
    preview.textContent = `${isWeak ? "弱点ボーナス：ダメージ2倍。 " : ""}${selectedSkill ? `${selectedSkill.name}のスキル：${selectedSkill.description}。` : "役職スキルは各遠征1回。"}`;
  }
});

app.addEventListener("keydown", event => {
  if (event.key === "Escape") document.querySelector(".modal-backdrop")?.remove();
});

render();
