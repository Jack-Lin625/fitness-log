import type { Muscle } from '../types/models';
import type { Position, Stretch } from './stretches';

/**
 * 練前動態熱身
 * 目的：提高體溫與心跳、讓今天要用到的關節活動開來。
 * 動作都是「動態」的，邊做邊數，不是停住不動的靜態拉伸（靜態拉伸放在練完後）。
 * 資料格式沿用 Stretch，多了每個動作自己的秒數。
 */
export interface Warmup extends Stretch {
  /** 這個動作進行的秒數（分左右時為每一邊） */
  seconds: number;
}

function w(
  id: string,
  name: string,
  position: Position,
  perSide: boolean,
  seconds: number,
  targets: Muscle[],
  detail: string,
  steps: string[],
  cues: string[],
  mistakes: string[],
  needs?: string,
): Warmup {
  const item: Warmup = { id, name, position, perSide, seconds, targets, detail, steps, cues, mistakes };
  if (needs) item.needs = needs;
  return item;
}

export const WARMUPS: Record<string, Warmup> = Object.fromEntries(
  [
    // ───────── 全身：每次都先做 ─────────
    w('jog', '原地小跑或開合跳', 'standing', false, 60, [], '提高心跳與體溫',
      ['原地小跑步，或改做開合跳', '從輕鬆的速度開始，慢慢加快'],
      ['做到身體微微發熱、呼吸變快即可', '腳步輕，用前腳掌著地'],
      ['一開始就衝很快', '用腳跟重重踩地']),

    // ───────── 下半身 ─────────
    w('leg-swing-front', '前後擺腿', 'standing', true, 20, ['hamstrings', 'hipFlexors', 'glutes'], '髖關節前後活動度',
      ['單手扶牆或柱子站穩', '外側腳前後擺動，幅度由小到大'],
      ['上半身保持直立', '擺動腳放鬆，像鐘擺一樣', '支撐腳膝蓋微彎'],
      ['上半身跟著前後晃', '一開始就用力甩到最高'],
      '可扶的牆或柱子'),
    w('leg-swing-side', '左右擺腿', 'standing', true, 20, ['adductors', 'abductors'], '大腿內外側、髖關節',
      ['面對牆，雙手扶牆', '一腳在身體前方左右擺動，幅度由小到大'],
      ['骨盆保持正對牆面', '擺動腳放鬆'],
      ['身體跟著轉', '擺動速度太快失去控制'],
      '牆面或柱子'),
    w('hip-circle', '髖關節繞環', 'standing', true, 20, ['glutes', 'hipFlexors', 'adductors'], '髖關節各方向活動',
      ['扶牆單腳站立', '另一腳抬膝，膝蓋往外畫一個大圓', '畫完幾圈後換方向'],
      ['圓畫得越大越好，但動作要慢', '支撐腳站穩，骨盆不要晃'],
      ['動作太快只是在甩腿', '圓圈越畫越小'],
      '可扶的牆或柱子'),
    w('bw-squat', '徒手深蹲', 'standing', false, 30, ['quads', 'glutes', 'adductors'], '膝、髖、踝的活動度',
      ['雙腳與肩同寬或稍寬，腳尖微微朝外', '臀部往後往下坐，蹲到舒服的深度', '站起來，重複'],
      ['膝蓋和腳尖同方向', '腳跟踩穩地面', '胸口保持抬起'],
      ['膝蓋往內夾', '腳跟離地', '彎腰駝背'],
    ),
    w('lunge-twist', '弓箭步轉體', 'standing', false, 30, ['quads', 'hipFlexors', 'obliques'], '大腿、髖屈肌、胸椎旋轉',
      ['往前跨一步成弓箭步', '上半身往前腳那一側轉', '轉回來、站起，換腳重複'],
      ['前腳膝蓋和腳尖同方向', '轉體時骨盆保持穩定'],
      ['前腳膝蓋往內倒', '後腳膝蓋重重撞地'],
    ),
    w('bw-good-morning', '徒手早安式', 'standing', false, 30, ['hamstrings', 'lowerBack', 'glutes'], '髖關節屈曲、腿後側',
      ['雙腳與髖同寬，雙手放在胸前或頭後', '膝蓋微彎，臀部往後推，上半身往前傾', '感覺大腿後側有拉到就站回來'],
      ['背保持平直', '動作從髖部開始'],
      ['拱背往下彎', '膝蓋彎太多變成蹲'],
    ),
    w('ankle-rock', '腳踝前推', 'kneeling', true, 20, ['calves'], '踝關節活動度',
      ['單膝跪地成半跪姿，前腳踩地', '膝蓋慢慢往前推過腳尖，再回來', '來回重複'],
      ['腳跟保持貼地', '膝蓋朝向第二、三根腳趾'],
      ['腳跟抬起', '膝蓋往內倒'],
    ),
    w('worlds-greatest', '世界最偉大伸展', 'standing', true, 25, ['hipFlexors', 'hamstrings', 'upperBack'], '髖屈肌、腿後、胸椎（一次活動多個部位）',
      ['往前跨一大步成低弓箭步，雙手撐地', '前腳同側的手肘往下靠近腳踝', '同一隻手往天花板打開，眼睛看手', '手回來撐地，臀部往後推、前腳伸直，然後重複'],
      ['後腳伸直', '轉開時胸口朝側面', '每個位置停一下下'],
      ['動作太快', '後腳膝蓋彎曲落地'],
    ),
    w('glute-bridge-w', '臀橋', 'lying', false, 30, ['glutes', 'hamstrings'], '喚醒臀部',
      ['仰躺屈膝，腳掌踩地與髖同寬', '夾臀把骨盆往上推，到身體成一直線', '頂端停 1 秒再慢慢放下'],
      ['用臀部出力，不是用腰', '肋骨往下收'],
      ['腰往上拱代替臀部出力', '膝蓋往內夾'],
    ),
    w('inchworm', '毛毛蟲爬', 'standing', false, 40, ['hamstrings', 'pecs', 'abs'], '腿後側、肩膀、核心',
      ['站姿往前彎，雙手撐地（膝蓋可以微彎）', '雙手慢慢往前爬到伏地挺身姿勢', '再用腳慢慢往手的方向走回來'],
      ['核心收緊，身體不要塌', '動作慢慢來'],
      ['腰往下塌', '手爬太遠撐不住'],
    ),

    // ───────── 上半身 ─────────
    w('arm-circle', '手臂繞環', 'standing', false, 30, ['frontDelts', 'sideDelts', 'rearDelts', 'traps'], '肩關節',
      ['雙手往兩側打開伸直', '從小圓開始往前畫，慢慢變大', '一半時間後改往後畫'],
      ['肩膀放鬆不聳肩', '圓圈由小到大'],
      ['一開始就畫很大很快', '聳肩'],
    ),
    w('arm-swing', '手臂開合擁抱', 'standing', false, 30, ['pecs', 'upperPecs', 'rearDelts'], '胸、肩膀',
      ['雙手往兩側打開，胸口往前', '再往前交叉，像抱住自己', '交替上下手，重複'],
      ['打開時肩胛骨往中間夾', '節奏輕鬆'],
      ['甩得太用力'],
    ),
    w('band-pull-apart-w', '彈力帶擴胸', 'standing', false, 30, ['rearDelts', 'upperBack'], '後三角、上背',
      ['雙手與肩同寬握住彈力帶，手臂往前伸直', '把彈力帶往兩側拉開到胸前', '慢慢回到原位'],
      ['肩胛骨往後下方夾', '手臂保持伸直'],
      ['聳肩', '用甩的'],
      '彈力帶'),
    w('wall-slide', '靠牆天使', 'standing', false, 30, ['lats', 'upperBack', 'frontDelts'], '肩膀上舉、上背',
      ['背靠牆站，手臂舉起成 W 字，手背貼牆', '手沿著牆往上滑成 Y 字', '再滑回 W 字'],
      ['下背貼近牆，肋骨往下收', '手滑不上去就縮小範圍'],
      ['腰往前拱離開牆', '聳肩'],
      '牆面'),
    w('scap-push-up', '肩胛伏地挺身', 'kneeling', false, 30, ['pecs', 'upperBack'], '肩胛骨活動（前鋸肌、菱形肌）',
      ['伏地挺身姿勢（膝蓋可以著地），手臂伸直', '不彎手肘，讓胸口往下沉、肩胛骨夾起來', '再把地板推開，讓肩胛骨分開'],
      ['手肘全程伸直', '動作只在肩胛骨'],
      ['手肘彎曲變成伏地挺身', '腰往下塌'],
    ),
    w('thoracic-rotation', '跪姿胸椎旋轉', 'kneeling', true, 20, ['upperBack', 'obliques'], '胸椎旋轉',
      ['四足跪姿，一手放在頭後', '手肘往下靠近另一手，再往天花板打開', '眼睛跟著手肘'],
      ['骨盆保持不動', '轉的是上背'],
      ['骨盆跟著轉', '動作太快'],
    ),
    w('cat-cow-w', '貓牛式', 'kneeling', false, 30, ['lowerBack', 'upperBack', 'lats'], '整條脊椎',
      ['四足跪姿，手在肩膀下、膝蓋在髖部下', '吐氣背往上拱、低頭；吸氣背往下凹、抬頭', '跟著呼吸重複'],
      ['一節一節慢慢動'],
      ['動作太快'],
    ),
    w('wrist-circle', '手腕繞環', 'standing', false, 20, ['forearms'], '手腕',
      ['雙手十指交扣', '手腕往同一方向繞圈，再換方向'],
      ['動作放鬆'],
      ['用力甩'],
    ),
  ].map((x) => [x.id, x]),
);

/** 每個肌群優先的熱身動作 */
const PLAN: Record<Muscle, string[]> = {
  quads: ['bw-squat', 'lunge-twist'],
  hamstrings: ['leg-swing-front', 'inchworm', 'bw-good-morning'],
  glutes: ['hip-circle', 'glute-bridge-w', 'bw-squat'],
  abductors: ['leg-swing-side'],
  adductors: ['leg-swing-side', 'hip-circle'],
  hipFlexors: ['worlds-greatest', 'leg-swing-front'],
  calves: ['ankle-rock'],
  pecs: ['arm-swing', 'scap-push-up'],
  upperPecs: ['arm-swing'],
  lats: ['wall-slide', 'cat-cow-w'],
  upperBack: ['band-pull-apart-w', 'thoracic-rotation'],
  traps: ['arm-circle'],
  lowerBack: ['cat-cow-w', 'bw-good-morning'],
  frontDelts: ['arm-circle', 'wall-slide'],
  sideDelts: ['arm-circle'],
  rearDelts: ['band-pull-apart-w', 'arm-circle'],
  biceps: ['arm-circle'],
  triceps: ['arm-circle'],
  forearms: ['wrist-circle'],
  abs: ['inchworm'],
  obliques: ['thoracic-rotation', 'lunge-twist'],
};

const ORDER: Position[] = ['standing', 'kneeling', 'seated', 'lying'];

/** 小跑以外最多、最少幾個動作（約 4–6 分鐘） */
export const MAX_WARMUPS = 7;
export const MIN_WARMUPS = 5;

/** 動作不夠時補上的通用動作 */
const UPPER_FILLER = ['thoracic-rotation', 'band-pull-apart-w', 'cat-cow-w', 'wall-slide'];
const LOWER_FILLER = ['worlds-greatest', 'hip-circle', 'glute-bridge-w', 'leg-swing-side'];
const LOWER_MUSCLES: Muscle[] = ['quads', 'hamstrings', 'glutes', 'abductors', 'adductors', 'hipFlexors', 'calves'];

/**
 * 依肌群排出熱身：先小跑，再依肌群重要性挑動作（每個肌群至少被一個動作照顧到），
 * 最後依姿勢排序，小跑固定在最前面。
 */
export function buildWarmup(muscles: Muscle[]): Warmup[] {
  const chosen: string[] = [];
  const covered = new Set<Muscle>();
  for (const m of muscles) {
    if (covered.has(m) || chosen.length >= MAX_WARMUPS) continue;
    const id = PLAN[m].find((x) => !chosen.includes(x)) ?? PLAN[m][0];
    if (!id || chosen.includes(id)) {
      covered.add(m);
      continue;
    }
    chosen.push(id);
    WARMUPS[id]?.targets.forEach((t) => covered.add(t));
  }

  // 第二輪：替重要的肌群補上第二個動作，直到達到最少數量
  for (const m of muscles) {
    if (chosen.length >= MIN_WARMUPS) break;
    const id = PLAN[m].find((x) => !chosen.includes(x));
    if (id) chosen.push(id);
  }
  // 還是不夠：依今天是上半身或下半身補通用動作
  if (muscles.length > 0 && chosen.length < MIN_WARMUPS) {
    const lower = muscles.filter((m) => LOWER_MUSCLES.includes(m)).length;
    const filler = lower * 2 >= muscles.length ? [...LOWER_FILLER, ...UPPER_FILLER] : [...UPPER_FILLER, ...LOWER_FILLER];
    for (const id of filler) {
      if (chosen.length >= MIN_WARMUPS) break;
      if (!chosen.includes(id)) chosen.push(id);
    }
  }

  const items = chosen
    .map((id) => WARMUPS[id])
    .filter((x): x is Warmup => x !== undefined)
    .sort((a, b) => ORDER.indexOf(a.position) - ORDER.indexOf(b.position));
  const jog = WARMUPS.jog;
  return jog ? [jog, ...items] : items;
}
