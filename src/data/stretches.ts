import type { BodyPart, Muscle } from '../types/models';
import { MUSCLE_PART } from './catalog';

/**
 * 訓練後的靜態拉伸與滾筒放鬆
 * 原則：拉到有緊繃感、不痛；不彈震；維持時自然呼吸，吐氣時可以再放鬆一點點。
 */

/** 姿勢：排列順序用，盡量減少起身、趴下的次數 */
export type Position = 'standing' | 'kneeling' | 'seated' | 'lying';
const POSITION_ORDER: Position[] = ['standing', 'kneeling', 'seated', 'lying'];
export const POSITION_LABELS: Record<Position, string> = {
  standing: '站姿',
  kneeling: '跪姿',
  seated: '坐姿',
  lying: '躺姿',
};

export interface Stretch {
  id: string;
  name: string;
  position: Position;
  /** 需要左右各做一次 */
  perSide: boolean;
  /** 拉到的肌群 */
  targets: Muscle[];
  /** 更細的部位說明，例如「股直肌、股外側肌、股內側肌」 */
  detail: string;
  /** 需要的東西（門框、毛巾、滾筒…） */
  needs?: string;
  /** 滾筒放鬆（預設不排入，可在設定開啟） */
  roller?: boolean;
  steps: string[];
  cues: string[];
  mistakes: string[];
}

function s(
  id: string,
  name: string,
  position: Position,
  perSide: boolean,
  targets: Muscle[],
  detail: string,
  steps: string[],
  cues: string[],
  mistakes: string[],
  extra: { needs?: string; roller?: boolean } = {},
): Stretch {
  return { id, name, position, perSide, targets, detail, steps, cues, mistakes, ...extra };
}

export const STRETCHES: Record<string, Stretch> = Object.fromEntries(
  [
    // ───────── 大腿前側（股四頭肌） ─────────
    s('standing-quad', '站姿大腿前側伸展', 'standing', true, ['quads', 'hipFlexors'], '股直肌、股外側肌、股內側肌',
      ['單腳站立，另一手扶牆或柱子', '彎曲後腳，手抓住同側腳踝', '把腳跟往臀部拉近'],
      ['兩膝靠攏，膝蓋朝向地面', '收緊臀部，骨盆微微往前推，大腿前側會更有感覺', '上半身保持直立'],
      ['膝蓋往外張開', '腰往後凹、肚子往前挺', '用力扯腳踝讓膝蓋不舒服'],
      { needs: '可扶的牆或柱子' }),
    s('couch-stretch', '靠牆跪姿大腿前側伸展', 'kneeling', true, ['quads', 'hipFlexors'], '股直肌、髖屈肌（強度較高）',
      ['背對牆跪下，一腳膝蓋貼近牆角，小腿沿著牆面往上', '另一腳往前踩成弓箭步', '上半身慢慢立起來'],
      ['收緊臀部，骨盆往前推', '覺得太緊就讓上半身往前傾一點', '膝蓋下方墊毛巾或軟墊'],
      ['腰往後凹代替髖部伸展', '一開始就立直身體，拉得太猛', '膝蓋直接壓在硬地上'],
      { needs: '牆面、軟墊' }),
    s('side-lying-quad', '側臥大腿前側伸展', 'lying', true, ['quads'], '股四頭肌',
      ['側躺，下方手臂當枕頭', '上方的腳彎曲，手抓住腳踝', '把腳跟往臀部拉'],
      ['兩膝上下對齊', '骨盆往前推，不要往後倒', '頭頸放鬆'],
      ['上方膝蓋往前跑', '身體往後翻倒'],
    ),

    // ───────── 大腿後側（股二頭肌、半腱肌、半膜肌） ─────────
    s('seated-hamstring', '坐姿單腿腿後伸展', 'seated', true, ['hamstrings'], '股二頭肌、半腱肌、半膜肌',
      ['坐地，一腳伸直，另一腳彎曲、腳掌貼在伸直那腳的大腿內側', '從髖部往前彎，雙手往伸直那隻腳的腳尖延伸'],
      ['背保持延長，想像胸口往腳尖靠近', '膝蓋可以微彎，感覺在大腿後側而不是膝蓋後面', '腳尖朝上'],
      ['拱背硬把頭壓向膝蓋', '彈震往前壓', '膝蓋後方出現刺痛還繼續拉'],
    ),
    s('standing-hamstring', '站姿腿後伸展', 'standing', true, ['hamstrings', 'calves'], '腿後肌群、小腿',
      ['一腳腳跟放在低矮的椅子或踏階上，腳尖朝上', '雙手放在大腿上，從髖部往前傾'],
      ['臀部往後推', '背保持平直', '支撐腳膝蓋微彎'],
      ['腳放太高', '彎腰駝背往前'],
      { needs: '低矮的椅子或踏階' }),
    s('lying-hamstring', '仰臥毛巾腿後伸展', 'lying', true, ['hamstrings', 'calves'], '腿後肌群（最溫和、好控制）',
      ['仰躺，毛巾或彈力帶勾住一腳腳掌', '把這隻腳往上抬，用毛巾慢慢拉向身體', '另一腳伸直貼地或屈膝踩地'],
      ['骨盆和下背貼地', '膝蓋盡量伸直，但不要鎖死', '肩膀放鬆'],
      ['抬腿時骨盆跟著離地', '用手臂猛拉'],
      { needs: '毛巾或彈力帶' }),

    // ───────── 大腿內側（內收肌） ─────────
    s('butterfly', '蝴蝶式', 'seated', false, ['adductors'], '內收長肌、內收短肌、股薄肌',
      ['坐地，兩腳掌相對貼合，腳跟拉近身體', '雙手握住腳踝或腳掌'],
      ['背打直，從髖部往前傾', '手肘可以輕壓大腿內側', '膝蓋自然往下沉'],
      ['硬把膝蓋往下壓', '拱背駝背'],
    ),
    s('straddle', '坐姿分腿前彎', 'seated', false, ['adductors', 'hamstrings'], '內收肌、腿後肌群',
      ['坐地，兩腳盡量往左右打開，腳尖朝上', '雙手往前放在地上，從髖部往前傾'],
      ['背保持延長', '膝蓋朝上，不要往內倒', '打開到有感覺即可'],
      ['腳張太開造成膝蓋內側不舒服', '拱背把頭往下壓'],
    ),
    s('frog', '青蛙式', 'kneeling', false, ['adductors'], '內收肌（強度較高）',
      ['四足跪姿，膝蓋慢慢往兩側打開', '小腿和膝蓋同高，腳掌朝外', '前臂撐地，臀部慢慢往後坐'],
      ['膝蓋下墊軟墊', '從小幅度開始', '保持自然呼吸'],
      ['一次打太開', '下背塌陷'],
      { needs: '軟墊' }),
    s('side-lunge-stretch', '側弓步伸展', 'standing', true, ['adductors'], '內收肌',
      ['雙腳打開比肩寬，腳尖朝前', '身體往一側蹲，彎曲那側膝蓋', '另一腳伸直，腳掌踩地'],
      ['臀部往後坐', '彎曲的膝蓋和腳尖同方向', '胸口保持抬起'],
      ['彎曲的膝蓋往內夾', '伸直腳的腳掌離地'],
    ),

    // ───────── 臀部、大腿外側（臀大肌、臀中肌） ─────────
    s('figure-four', '仰臥臀部伸展（4 字）', 'lying', true, ['glutes', 'abductors'], '臀大肌、梨狀肌',
      ['仰躺屈膝，一腳腳踝放到另一腳膝蓋上', '雙手抱住下方那隻腳的大腿後側，往胸口拉'],
      ['上方膝蓋往外推一點', '頭和肩膀放鬆貼地', '尾椎貼地'],
      ['抬頭聳肩用力拉', '腳踝放在膝蓋正上方的骨頭上壓到不舒服'],
    ),
    s('pigeon', '鴿式', 'kneeling', true, ['glutes', 'hipFlexors'], '臀大肌、臀中肌、後腳髖屈肌',
      ['四足跪姿，一腳膝蓋往前移到同側手腕附近，小腿斜放在身體前方', '另一腳往後伸直', '雙手撐地，慢慢讓骨盆下沉'],
      ['骨盆保持正對前方', '覺得太強就在前腳臀部下方墊東西', '可以慢慢趴低上半身'],
      ['骨盆歪向一側', '前腳膝蓋出現疼痛還硬撐'],
    ),
    s('seated-figure-four', '坐姿 4 字臀部伸展', 'seated', true, ['glutes'], '臀大肌、梨狀肌',
      ['坐在椅子上，一腳腳踝放到另一腳膝蓋上', '背打直，從髖部慢慢往前傾'],
      ['上方膝蓋自然往下沉', '胸口往前，不是低頭'],
      ['駝背低頭', '用手硬壓膝蓋'],
      { needs: '椅子或訓練椅' }),
    s('supine-cross', '仰臥交叉腿臀外側伸展', 'lying', true, ['abductors', 'glutes'], '臀中肌、闊筋膜張肌（大腿外側）',
      ['仰躺，一腳屈膝', '用另一側的手把屈膝那腳往身體對側帶', '雙肩保持貼地'],
      ['感覺在臀部外側到大腿外側', '頭可以轉向另一邊', '吐氣時讓膝蓋再往下沉一點'],
      ['肩膀跟著離地', '用力扯膝蓋'],
    ),
    s('standing-cross-side', '站姿交叉側彎（大腿外側）', 'standing', true, ['abductors'], '臀中肌、闊筋膜張肌',
      ['站在牆邊，靠牆那隻腳往後交叉到另一腳後方', '髖部往牆的方向推，上半身往反方向側彎'],
      ['感覺在後腳的髖部外側', '另一手可以扶牆保持平衡'],
      ['身體往前彎', '髖部沒有往外推'],
      { needs: '牆面' }),

    // ───────── 髖屈肌 ─────────
    s('kneeling-hip-flexor', '跪姿髖部前側伸展', 'kneeling', true, ['hipFlexors', 'quads'], '髂腰肌、股直肌',
      ['單膝跪地成弓箭步，後膝下墊毛巾', '收緊後腳那側的臀部', '骨盆慢慢往前推'],
      ['上半身保持直立', '後腳同側的手往上舉，感覺會更明顯', '前腳膝蓋不要超過太多'],
      ['腰往後凹代替髖部伸展', '骨盆沒有收緊就往前衝'],
      { needs: '毛巾或軟墊' }),

    // ───────── 小腿（腓腸肌、比目魚肌） ─────────
    s('calf-straight', '靠牆小腿伸展（直膝）', 'standing', true, ['calves'], '腓腸肌（小腿上段）',
      ['雙手扶牆，一腳往後跨一大步', '後腳伸直，腳跟踩地', '身體往前靠向牆面'],
      ['後腳腳尖朝正前方', '腳跟不要離地'],
      ['腳尖往外轉', '後腳膝蓋彎曲（會變成另一個動作）'],
      { needs: '牆面' }),
    s('calf-bent', '靠牆小腿伸展（屈膝）', 'standing', true, ['calves'], '比目魚肌（小腿下段、阿基里斯腱上方）',
      ['同直膝版本站好，後腳往前縮小一點', '後腳膝蓋微彎，重心往下沉'],
      ['腳跟保持貼地', '感覺在小腿下半段'],
      ['腳跟抬起', '彎太多變成蹲下'],
      { needs: '牆面' }),
    s('step-calf', '階梯小腿下沉', 'standing', true, ['calves'], '腓腸肌、比目魚肌',
      ['前腳掌踩在踏階或槓片邊緣，手扶著東西', '慢慢讓一腳腳跟往下沉'],
      ['動作慢，停在有感覺的位置', '身體保持直立'],
      ['快速上下彈震', '沒有扶好失去平衡'],
      { needs: '踏階或槓片、可扶的東西' }),

    // ───────── 胸 ─────────
    s('doorway-chest', '門框胸部伸展', 'standing', false, ['pecs', 'frontDelts'], '胸大肌中段、前三角',
      ['雙手前臂貼在門框兩側，手肘約與肩同高', '一腳往前跨一小步，身體慢慢往前傾'],
      ['肩膀放鬆下沉', '感覺在胸前，不是肩膀前側', '腹部微收，不要挺腰'],
      ['聳肩', '身體往前衝太多造成肩膀不適'],
      { needs: '門框或兩根柱子' }),
    s('doorway-low', '門框低位胸部伸展', 'standing', true, ['upperPecs', 'frontDelts'], '上胸（鎖骨部）',
      ['側站在門框旁，單手放在比肩膀低的位置', '身體慢慢轉離手臂的方向'],
      ['手臂伸直但不鎖死', '肩膀往後下方收'],
      ['手放太低造成肩膀前側緊繃', '聳肩'],
      { needs: '門框或柱子' }),
    s('behind-back-clasp', '背後扣手擴胸', 'standing', false, ['pecs', 'frontDelts', 'biceps'], '胸大肌、前三角、二頭肌',
      ['雙手在背後十指相扣', '手臂伸直，慢慢往後下方延伸', '胸口往前上方打開'],
      ['肩胛骨往中間夾', '下巴微收', '握不到可以抓毛巾'],
      ['身體往前彎', '腰往後凹'],
    ),

    // ───────── 背 ─────────
    s('childs-pose', '嬰兒式', 'kneeling', false, ['lats', 'lowerBack'], '背闊肌、下背',
      ['跪坐，臀部往腳跟坐下', '雙手往前伸直貼地，額頭靠近地面'],
      ['手往前延伸、臀部往後坐，感覺背部兩側被拉長', '自然深呼吸，感覺背部隨呼吸擴張'],
      ['臀部離開腳跟', '聳肩'],
    ),
    s('side-childs-pose', '側邊嬰兒式', 'kneeling', true, ['lats', 'obliques'], '背闊肌、身體側面',
      ['從嬰兒式開始', '雙手一起往一側移動', '臀部保持坐在腳跟上'],
      ['感覺在對側的腋下到腰側', '吐氣時手再往遠處延伸'],
      ['臀部跟著轉向側邊'],
    ),
    s('dead-hang', '單槓懸吊', 'standing', false, ['lats', 'forearms'], '背闊肌、肩膀、前臂',
      ['雙手握住單槓，比肩稍寬', '雙腳慢慢離地或屈膝，讓身體自然垂掛'],
      ['肩膀可以放鬆往上', '腳可以輕輕點地減輕重量', '握力不夠就提早下來'],
      ['肩膀有疼痛還繼續掛', '突然跳下來'],
      { needs: '單槓' }),
    s('standing-side-bend', '站姿側彎伸展', 'standing', true, ['lats', 'obliques'], '背闊肌、腹斜肌',
      ['雙腳與肩同寬，一手高舉過頭', '身體往另一側慢慢彎'],
      ['感覺在腋下到腰側', '身體保持在同一平面，不往前彎'],
      ['往前彎腰', '骨盆往外推太多'],
    ),
    s('upper-back-hug', '抱臂拱背（上背伸展）', 'standing', false, ['upperBack', 'rearDelts'], '菱形肌、中斜方肌、後三角',
      ['雙手交叉抱住自己，手掌放在對側肩胛骨上', '上背往後拱起，像抱著一顆大球', '低頭看肚臍'],
      ['感覺肩胛骨之間被拉開', '下半身保持穩定'],
      ['只有低頭，背沒有拱'],
    ),
    s('neck-side', '頸側伸展（上斜方肌）', 'seated', true, ['traps'], '上斜方肌',
      ['坐直，一手抓住椅子邊緣讓肩膀往下', '頭慢慢往另一側倒，耳朵靠近肩膀', '另一手可以輕放在頭上'],
      ['手只放著，不要用力拉', '感覺在脖子側面到肩膀'],
      ['用手猛拉頭', '頭往前低或轉動'],
    ),
    s('knees-to-chest', '仰臥抱膝', 'lying', false, ['lowerBack', 'glutes'], '下背、臀部',
      ['仰躺，雙膝彎曲', '雙手抱住膝蓋，往胸口拉'],
      ['下背貼地', '可以輕輕左右搖晃放鬆'],
      ['抬頭聳肩'],
    ),
    s('supine-twist', '仰臥脊椎扭轉', 'lying', true, ['lowerBack', 'obliques', 'glutes'], '下背、腹斜肌、臀部',
      ['仰躺，雙手往兩側打開', '雙膝彎曲併攏，慢慢倒向一側', '頭轉向另一側'],
      ['肩膀保持貼地', '吐氣時讓膝蓋再往下沉一點'],
      ['肩膀離地', '膝蓋硬壓到地上'],
    ),
    s('cat-cow', '貓牛式（動態）', 'kneeling', false, ['lowerBack', 'upperBack'], '整條脊椎',
      ['四足跪姿，手在肩膀下、膝蓋在髖部下', '吐氣時背往上拱、低頭（貓）', '吸氣時背往下凹、抬頭（牛）', '時間內慢慢重複'],
      ['動作跟著呼吸', '一節一節慢慢動'],
      ['動作太快', '手肘鎖死'],
    ),

    // ───────── 肩 ─────────
    s('cross-body', '手臂橫胸伸展', 'standing', true, ['rearDelts', 'upperBack'], '後三角、上背',
      ['一手伸直橫過胸前', '另一手扣住手肘上方，把手臂拉近身體'],
      ['肩膀下沉，不要聳肩', '身體不要跟著轉'],
      ['扣在手肘關節上壓迫手肘', '聳肩'],
    ),
    s('behind-back-arm', '背後拉手臂（側三角）', 'standing', true, ['sideDelts'], '側三角',
      ['雙手放在背後，一手抓住另一手的手腕', '把被抓的手臂往對側、往下拉'],
      ['頭可以往被拉的反方向倒，感覺更明顯', '肩膀放鬆下沉'],
      ['用力猛拉', '身體歪斜'],
    ),

    // ───────── 手臂 ─────────
    s('overhead-triceps', '過頭三頭伸展', 'standing', true, ['triceps', 'lats'], '三頭肌（長頭）、背闊肌',
      ['一手舉高後彎，手掌往背後放', '另一手輕壓手肘往後、往下'],
      ['身體保持直立', '手肘指向天花板'],
      ['腰往後凹', '頭往前推'],
    ),
    s('wall-biceps', '靠牆二頭伸展', 'standing', true, ['biceps', 'pecs'], '二頭肌、胸大肌',
      ['側站在牆邊，手臂往後伸直、掌心貼牆，約與肩同高', '身體慢慢轉離牆面'],
      ['手肘伸直但不鎖死', '感覺在手臂前側'],
      ['手放太高造成肩膀前側不適'],
      { needs: '牆面' }),
    s('wrist-flexor', '前臂內側伸展', 'standing', true, ['forearms'], '前臂屈肌（握力相關）',
      ['手臂往前伸直，掌心朝上', '另一手把手指輕輕往下、往身體方向拉'],
      ['手肘保持伸直', '慢慢拉，不要用力扳'],
      ['手肘彎曲', '用力扳手指'],
    ),
    s('wrist-extensor', '前臂外側伸展', 'standing', true, ['forearms'], '前臂伸肌',
      ['手臂往前伸直，掌心朝下', '另一手把手背輕輕往下、往身體方向壓'],
      ['手肘保持伸直', '可以握拳讓感覺更明顯'],
      ['手肘彎曲', '用力壓'],
    ),

    // ───────── 核心 ─────────
    s('cobra', '眼鏡蛇式', 'lying', false, ['abs', 'hipFlexors'], '腹直肌、髖屈肌',
      ['趴地，雙手放在肩膀下方', '手慢慢推地，抬起上半身', '骨盆保持貼地'],
      ['肩膀往後下方，遠離耳朵', '下背不舒服就降低高度，改用前臂撐地'],
      ['聳肩', '硬推到下背疼痛'],
    ),

    // ───────── 滾筒放鬆（預設不排入） ─────────
    s('roll-outer-thigh', '滾筒放鬆大腿外側', 'lying', true, ['quads', 'abductors'], '股外側肌',
      ['側躺，滾筒放在大腿外側', '上方腳踩在前方地上分擔重量', '從髖部下方慢慢滾到膝蓋上方'],
      ['速度要慢，遇到較緊的點停留幾秒', '用踩地的腳控制力道'],
      ['滾到膝蓋或髖部骨頭上', '整個人壓上去痛到憋氣'],
      { needs: '滾筒', roller: true }),
    s('roll-quads', '滾筒放鬆大腿前側', 'lying', true, ['quads'], '股直肌、股內側肌、股外側肌',
      ['趴姿，滾筒放在大腿前側，前臂撐地', '從髖部下方慢慢滾到膝蓋上方', '腳尖往內、往外轉，可以放鬆到內側和外側'],
      ['腹部收緊，不要塌腰', '速度要慢'],
      ['滾到膝蓋骨上', '腰往下塌'],
      { needs: '滾筒', roller: true }),
    s('roll-hamstrings', '滾筒放鬆大腿後側', 'seated', true, ['hamstrings'], '腿後肌群',
      ['坐姿，滾筒放在大腿後側，雙手撐在身後', '把臀部抬起，從臀部下方滾到膝蓋上方'],
      ['另一腳可以疊上來增加力道', '速度要慢'],
      ['滾到膝蓋後方'],
      { needs: '滾筒', roller: true }),
    s('roll-calves', '滾筒放鬆小腿', 'seated', true, ['calves'], '腓腸肌、比目魚肌',
      ['坐姿，滾筒放在小腿下方，雙手撐在身後', '臀部抬起，從腳踝上方滾到膝蓋下方'],
      ['腳尖往內、往外轉，放鬆到不同區域'],
      ['滾到膝蓋後方或腳踝骨頭'],
      { needs: '滾筒', roller: true }),
    s('roll-upper-back', '滾筒放鬆上背', 'lying', false, ['upperBack', 'lats'], '菱形肌、中斜方肌、背闊肌',
      ['仰躺，滾筒放在肩胛骨下方，雙手抱頭或交叉抱胸', '臀部抬起，在上背範圍慢慢前後滾'],
      ['雙手扶頭，脖子放鬆', '側躺一點可以放鬆到背闊肌'],
      ['滾到下背（腰椎）', '用力把頭往前扳'],
      { needs: '滾筒', roller: true }),
  ].map((x) => [x.id, x]),
);

/**
 * 每個肌群優先使用的拉伸（前面的優先）
 * 大肌群會排 2 個不同角度的動作，小肌群 1 個。
 */
const MUSCLE_PLAN: Record<Muscle, { ids: string[]; need: number }> = {
  quads: { ids: ['standing-quad', 'couch-stretch', 'side-lying-quad'], need: 2 },
  hamstrings: { ids: ['seated-hamstring', 'lying-hamstring', 'standing-hamstring'], need: 2 },
  glutes: { ids: ['figure-four', 'pigeon', 'seated-figure-four'], need: 2 },
  abductors: { ids: ['supine-cross', 'standing-cross-side'], need: 1 },
  adductors: { ids: ['butterfly', 'side-lunge-stretch', 'straddle', 'frog'], need: 2 },
  hipFlexors: { ids: ['kneeling-hip-flexor', 'couch-stretch'], need: 1 },
  calves: { ids: ['calf-straight', 'calf-bent', 'step-calf'], need: 2 },
  pecs: { ids: ['doorway-chest', 'behind-back-clasp'], need: 2 },
  upperPecs: { ids: ['doorway-low', 'behind-back-clasp'], need: 1 },
  lats: { ids: ['childs-pose', 'side-childs-pose', 'dead-hang', 'standing-side-bend'], need: 2 },
  upperBack: { ids: ['upper-back-hug', 'cat-cow'], need: 1 },
  traps: { ids: ['neck-side'], need: 1 },
  lowerBack: { ids: ['knees-to-chest', 'supine-twist', 'childs-pose'], need: 2 },
  frontDelts: { ids: ['doorway-chest', 'behind-back-clasp'], need: 1 },
  sideDelts: { ids: ['behind-back-arm'], need: 1 },
  rearDelts: { ids: ['cross-body', 'upper-back-hug'], need: 1 },
  biceps: { ids: ['wall-biceps', 'behind-back-clasp'], need: 1 },
  triceps: { ids: ['overhead-triceps'], need: 1 },
  forearms: { ids: ['wrist-flexor', 'wrist-extensor'], need: 2 },
  abs: { ids: ['cobra'], need: 1 },
  obliques: { ids: ['supine-twist', 'standing-side-bend', 'side-childs-pose'], need: 1 },
};

/** 滾筒放鬆對應的肌群 */
const ROLLER_PLAN: Partial<Record<Muscle, string[]>> = {
  quads: ['roll-quads', 'roll-outer-thigh'],
  abductors: ['roll-outer-thigh'],
  hamstrings: ['roll-hamstrings'],
  calves: ['roll-calves'],
  upperBack: ['roll-upper-back'],
  lats: ['roll-upper-back'],
};

/** 一次拉伸最多幾個動作，避免太長沒人想做 */
export const MAX_STRETCHES = 12;

export interface RoutineOptions {
  /** 加入滾筒放鬆 */
  roller?: boolean;
}

/**
 * 依肌群排出拉伸清單
 * 1. 依傳入順序（越前面越重要）替每個肌群挑動作，直到覆蓋次數達標
 *    （一個動作若同時拉到多個肌群，會一起計算）
 * 2. 超過上限就停止
 * 3. 依姿勢排序（站 → 跪 → 坐 → 躺），滾筒放鬆放最前面（先放鬆再拉伸）
 */
export function buildRoutine(muscles: Muscle[], opts: RoutineOptions = {}): Stretch[] {
  const chosen: string[] = [];
  const coverage = new Map<Muscle, number>();
  const add = (id: string) => {
    if (chosen.includes(id) || chosen.length >= MAX_STRETCHES) return;
    const st = STRETCHES[id];
    if (!st) return;
    chosen.push(id);
    st.targets.forEach((m) => coverage.set(m, (coverage.get(m) ?? 0) + 1));
  };

  for (const m of muscles) {
    const plan = MUSCLE_PLAN[m];
    for (const id of plan.ids) {
      if ((coverage.get(m) ?? 0) >= plan.need) break;
      add(id);
    }
  }

  const rollers: Stretch[] = [];
  if (opts.roller) {
    const ids = new Set(muscles.flatMap((m) => ROLLER_PLAN[m] ?? []));
    ids.forEach((id) => {
      const st = STRETCHES[id];
      if (st) rollers.push(st);
    });
  }

  const stretches = chosen
    .map((id) => STRETCHES[id])
    .filter((x): x is Stretch => x !== undefined)
    .sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position));
  return [...rollers, ...stretches];
}

/** 部位 → 該部位所有肌群（舊版網址、快速全選用） */
export function musclesOfParts(parts: BodyPart[]): Muscle[] {
  return (Object.keys(MUSCLE_PART) as Muscle[]).filter((m) => parts.includes(MUSCLE_PART[m]));
}

/** 換到下一個動作前的準備秒數、左右換邊的準備秒數 */
export const PREP_SECONDS = 8;
export const SWITCH_SECONDS = 4;

/** 預估總時間（秒） */
export function routineSeconds(routine: Stretch[], holdSeconds: number): number {
  return routine.reduce(
    (sum, x) => sum + PREP_SECONDS + (x.perSide ? holdSeconds * 2 + SWITCH_SECONDS : holdSeconds),
    0,
  );
}
