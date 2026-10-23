import type {FinalId} from './types.js';

interface ErhuaRow {
  readonly final: FinalId;
  readonly after: string;
  readonly example: string;
  readonly label?: string;
  readonly before?: string;
  readonly alternative?: string;
}
interface ErhuaGroup {
  readonly title: string;
  readonly note: string;
  readonly rows: readonly ErhuaRow[];
}

// Teaching examples, not a productive IPA conversion or syllable inventory.
// Broad transcription follows this app's base finals. Lee (2005), sections 3.1–3.4,
// describes the changes; Duanmu (2021), table 29, also supplies o/ueng examples.
// XAUT's teaching guide supports the retained-vowel account for ie/üe and the
// replacement account for apical i. Alternatives illustrate different analyses.
export const erhuaGroups: readonly ErhuaGroup[] = [
  {title:'rの響きを帯びる母音', note:'母音の音色や、音の移り方も変わることがあります。', rows:[
    {final:'a', after:'ɐ˞', example:'马 mǎ → 马儿 mǎr'},
    {final:'ia', after:'jɐ˞', example:'匣 xiá → 匣儿 xiár'},
    {final:'ua', after:'wɐ˞', example:'花 huā → 花儿 huār'},
    {final:'o', before:'wo', after:'wo˞', label:'o（唇音の後）', example:'婆 pó → 婆儿 pór'},
    {final:'uo', after:'wo˞', example:'窝 wō → 窝儿 wōr'},
    {final:'e', after:'ɤ˞', example:'歌 gē → 歌儿 gēr'},
    {final:'u', after:'u˞', example:'肚 dù → 肚儿 dùr'},
    {final:'ao', after:'ɑu̯˞', example:'包 bāo → 包儿 bāor'},
    {final:'iao', after:'jɑu̯˞', example:'条 tiáo → 条儿 tiáor'},
    {final:'ou', after:'ou̯˞', example:'头 tóu → 头儿 tóur'},
    {final:'iou', after:'jou̯˞', label:'iou（iu）', example:'球 qiú → 球儿 qiúr'},
  ]},
  {title:'-i・-n の脱落とア寄りの母音', note:'末尾の [i̯] や [n] が消え、母音がrの響きを帯びます。', rows:[
    {final:'ai', after:'ɐ˞', example:'盖 gài → 盖儿 gàir'},
    {final:'an', after:'ɐ˞', example:'盘 pán → 盘儿 pánr'},
    {final:'uai', after:'wɐ˞', example:'块 kuài → 块儿 kuàir'},
    {final:'uan', after:'wɐ˞', example:'玩 wán → 玩儿 wánr'},
  ]},
  {title:'-i・-n の脱落と [ɚ] 系の音', note:'uei・uen では初めの [w] が残ります。', rows:[
    {final:'ei', after:'ɚ', example:'辈 bèi → 辈儿 bèir'},
    {final:'en', after:'ɚ', example:'根 gēn → 根儿 gēnr'},
    {final:'uei', after:'wɚ', label:'uei（ui）', example:'味 wèi → 味儿 wèir'},
    {final:'uen', after:'wɚ', label:'uen（un）', example:'纹 wén → 纹儿 wénr'},
  ]},
  {title:'ian・üan の母音の変化', note:'末尾の [n] が消え、主母音が中央寄りになってrの響きを帯びます。', rows:[
    {final:'ian', after:'jɐ˞', alternative:'jəɚ', example:'点 diǎn → 点儿 diǎnr'},
    {final:'üan', after:'ɥɐ˞', alternative:'ɥəɚ', example:'远 yuǎn → 远儿 yuǎnr'},
  ]},
  {title:'i・ü から [ɚ] への移行', note:'in・ün の末尾の [n] は消えます。[iɚ̯]・[yɚ̯] は一音節内での音の移り方を表します。', rows:[
    {final:'i', after:'iɚ̯', example:'皮 pí → 皮儿 pír'},
    {final:'ü', after:'yɚ̯', example:'鱼 yú → 鱼儿 yúr'},
    {final:'in', after:'iɚ̯', example:'心 xīn → 心儿 xīnr'},
    {final:'ün', after:'yɚ̯', example:'裙 qún → 裙儿 qúnr'},
  ]},
  {title:'ie・üe の後半の母音の変化', note:'[ɛ] がrの響きを帯びる表記のほか、[ɛ] が消えて [ɚ] へ移る分析もあります。', rows:[
    {final:'ie', after:'jɛ˞', alternative:'iɚ̯', example:'街 jiē → 街儿 jiēr'},
    {final:'üe', after:'ɥɛ˞', alternative:'yɚ̯', example:'靴 xuē → 靴儿 xuēr'},
  ]},
  {title:'-ng の脱落と母音の鼻音の響き', note:'母音がrの響きと鼻音の響きを帯びます。鼻音の響きの強さは話者によって異なります。', rows:[
    {final:'ang', after:'ɑ̃˞', example:'缸 gāng → 缸儿 gāngr'},
    {final:'eng', after:'ɚ̃', example:'灯 dēng → 灯儿 dēngr'},
    {final:'ing', after:'ĩɚ̯̃', example:'影 yǐng → 影儿 yǐngr'},
    {final:'ong', after:'ʊ̃˞', example:'虫 chóng → 虫儿 chóngr'},
    {final:'iang', after:'jɑ̃˞', example:'样 yàng → 样儿 yàngr'},
    {final:'uang', after:'wɑ̃˞', example:'黄 huáng → 黄儿 huángr'},
    {final:'iong', after:'jʊ̃˞', example:'熊 xióng → 熊儿 xióngr'},
    {final:'ueng', after:'wɚ̃', example:'翁 wēng → 翁儿 wēngr'},
  ]},
  {title:'舌先の i の変化', note:'zi系・zhi系の音節の中心が [ɚ] 系の音に変わります。', rows:[
    {final:'-i(z)', after:'ɚ', label:'i（zi・ci・si）', example:'刺 cì → 刺儿 cìr'},
    {final:'-i(zh)', after:'ɚ', label:'i（zhi・chi・shi・ri）', example:'事 shì → 事儿 shìr'},
  ]},
];
