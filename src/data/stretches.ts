import type { BodyPart } from '../types/models';

/**
 * 訓練後的靜態拉伸動作
 * 每個動作只列 2–3 個最重要的提示；拉伸都是「拉到有感覺、不痛」的程度。
 */
export interface Stretch {
  id: string;
  name: string;
  /** 主要拉到的部位 */
  target: string;
  /** 需要左右各做一次 */
  perSide: boolean;
  cues: string[];
}

export const STRETCHES: Record<string, Stretch> = {
  'doorway-chest': {
    id: 'doorway-chest',
    name: '門框胸部伸展',
    target: '胸、肩膀前側',
    perSide: false,
    cues: ['雙手前臂貼在門框兩側，手肘約與肩同高', '身體慢慢往前傾，感覺胸前被拉開', '肩膀放鬆下沉，不要聳肩'],
  },
  'wall-biceps': {
    id: 'wall-biceps',
    name: '靠牆手臂前側伸展',
    target: '二頭肌、胸',
    perSide: true,
    cues: ['側站在牆邊，手臂伸直、掌心貼牆，約與肩同高', '身體慢慢轉離牆面', '感覺手臂前側到胸口被拉開'],
  },
  'childs-pose': {
    id: 'childs-pose',
    name: '嬰兒式',
    target: '背部、下背',
    perSide: false,
    cues: ['跪坐，臀部往腳跟坐下', '雙手往前伸直貼地，額頭靠近地面', '感覺背部兩側被拉長，自然呼吸'],
  },
  'side-bend': {
    id: 'side-bend',
    name: '站姿側彎伸展',
    target: '背闊肌、身體側面',
    perSide: true,
    cues: ['雙腳與肩同寬，一手高舉過頭', '身體往另一側慢慢彎', '感覺腋下到腰側被拉長，不要往前彎'],
  },
  'seated-twist': {
    id: 'seated-twist',
    name: '坐姿脊椎扭轉',
    target: '上背、腰側',
    perSide: true,
    cues: ['坐地，一腳屈膝跨到另一腳外側', '身體往屈膝那一側轉，另一手手肘輕抵膝蓋外側', '背保持挺直，轉到有感覺即可'],
  },
  'quad-stretch': {
    id: 'quad-stretch',
    name: '站姿大腿前側伸展',
    target: '股四頭肌',
    perSide: true,
    cues: ['單腳站立，可以扶牆保持平衡', '手抓同側腳踝，把腳跟拉向臀部', '兩膝靠攏，骨盆微微往前推'],
  },
  hamstring: {
    id: 'hamstring',
    name: '坐姿大腿後側伸展',
    target: '腿後肌群',
    perSide: true,
    cues: ['坐地，一腳伸直，另一腳彎曲、腳掌貼大腿內側', '從髖部往前彎，手往伸直那隻腳的腳尖延伸', '背保持延長，不要拱背硬壓'],
  },
  'hip-flexor': {
    id: 'hip-flexor',
    name: '跪姿髖部前側伸展',
    target: '髖屈肌',
    perSide: true,
    cues: ['單膝跪地成弓箭步，後膝下可以墊毛巾', '收緊臀部，骨盆慢慢往前推', '感覺後腳大腿前側到髖部被拉開'],
  },
  'figure-four': {
    id: 'figure-four',
    name: '仰臥臀部伸展（4 字）',
    target: '臀部',
    perSide: true,
    cues: ['仰躺，一腳腳踝放到另一腳膝蓋上', '雙手抱住下方那隻腳的大腿，往胸口拉', '頭和肩膀放鬆貼地'],
  },
  calf: {
    id: 'calf',
    name: '靠牆小腿伸展',
    target: '小腿',
    perSide: true,
    cues: ['雙手扶牆，一腳在前、一腳往後跨', '後腳伸直、腳跟踩地，身體往前靠', '腳尖朝正前方'],
  },
  'cross-body': {
    id: 'cross-body',
    name: '手臂橫胸伸展',
    target: '肩膀後側',
    perSide: true,
    cues: ['一手伸直橫過胸前', '另一手扣住手肘，把手臂拉近身體', '肩膀下沉，不要聳肩'],
  },
  'overhead-triceps': {
    id: 'overhead-triceps',
    name: '過頭三頭伸展',
    target: '三頭肌',
    perSide: true,
    cues: ['一手舉高後彎，手掌往背後放', '另一手輕壓手肘往下', '身體保持直立，不要往後仰'],
  },
  forearm: {
    id: 'forearm',
    name: '前臂伸展',
    target: '前臂',
    perSide: true,
    cues: ['手臂往前伸直，掌心朝上', '另一手把手指輕輕往下、往身體方向拉', '手肘保持伸直'],
  },
  cobra: {
    id: 'cobra',
    name: '眼鏡蛇式',
    target: '腹部',
    perSide: false,
    cues: ['趴地，雙手放在肩膀下方', '手慢慢推地抬起上半身，骨盆貼地', '下背不舒服就降低高度'],
  },
};

/** 各部位的拉伸順序（前面的優先），以及每個部位最多選幾個 */
const PART_PLAN: Record<BodyPart, { ids: string[]; take: number }> = {
  chest: { ids: ['doorway-chest', 'wall-biceps'], take: 2 },
  back: { ids: ['childs-pose', 'side-bend', 'seated-twist'], take: 2 },
  legs: { ids: ['quad-stretch', 'hamstring', 'hip-flexor', 'figure-four', 'calf'], take: 4 },
  shoulders: { ids: ['cross-body', 'doorway-chest'], take: 2 },
  arms: { ids: ['overhead-triceps', 'wall-biceps', 'forearm'], take: 2 },
  core: { ids: ['cobra', 'hip-flexor'], take: 1 },
};

/** 依部位排出拉伸清單（不重複） */
export function buildRoutine(parts: BodyPart[]): Stretch[] {
  const ids: string[] = [];
  for (const part of parts) {
    const plan = PART_PLAN[part];
    let added = 0;
    for (const id of plan.ids) {
      if (added >= plan.take) break;
      if (!ids.includes(id)) ids.push(id);
      added++;
    }
  }
  return ids.map((id) => STRETCHES[id]).filter((s): s is Stretch => s !== undefined);
}

/** 換到下一個動作前的準備秒數、左右換邊的準備秒數 */
export const PREP_SECONDS = 5;
export const SWITCH_SECONDS = 3;

/** 預估總時間（秒） */
export function routineSeconds(routine: Stretch[], holdSeconds: number): number {
  return routine.reduce(
    (sum, s) => sum + PREP_SECONDS + (s.perSide ? holdSeconds * 2 + SWITCH_SECONDS : holdSeconds),
    0,
  );
}
