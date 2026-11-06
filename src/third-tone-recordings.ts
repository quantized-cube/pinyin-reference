import type {PronunciationExample, ThirdToneContextId, ThirdToneFormId} from './types.js';

interface ThirdToneRecording extends PronunciationExample {
  readonly form: ThirdToneContextId;
  readonly url: string;
}

export const thirdToneRecordings: readonly ThirdToneRecording[] = [
  {text: '好吃', tokens: ['hao3', 'chi1'], target: 0, form: 'half', url: 'audio/third-tone/haochi.mp3'},
  {text: '老师', tokens: ['lao3', 'shi1'], target: 0, form: 'half', url: 'audio/third-tone/laoshi.mp3'},
  {text: '老板', tokens: ['lao3', 'ban3'], target: 0, form: 'sandhi', url: 'audio/third-tone/laoban.mp3'},
  {text: '水平', tokens: ['shui3', 'ping2'], target: 0, form: 'half', url: 'audio/third-tone/shuiping.mp3'},
  {text: '水果', tokens: ['shui3', 'guo3'], target: 0, form: 'sandhi', url: 'audio/third-tone/shuiguo.mp3'},
  {text: '准备', tokens: ['zhun3', 'bei4'], target: 0, form: 'half', url: 'audio/third-tone/zhunbei.mp3'},
  {text: '准许', tokens: ['zhun3', 'xu3'], target: 0, form: 'sandhi', url: 'audio/third-tone/zhunxu.mp3'},
  {text: '点名', tokens: ['dian3', 'ming2'], target: 0, form: 'half', url: 'audio/third-tone/dian3-half.mp3'},
  {text: '点火', tokens: ['dian3', 'huo3'], target: 0, form: 'sandhi', url: 'audio/third-tone/dian3-sandhi.mp3'},
  {text: '法国', tokens: ['fa3', 'guo2'], target: 0, form: 'half', url: 'audio/third-tone/fa3-half.mp3'},
  {text: '法语', tokens: ['fa3', 'yu3'], target: 0, form: 'sandhi', url: 'audio/third-tone/fa3-sandhi.mp3'},
  {text: '可惜', tokens: ['ke3', 'xi1'], target: 0, form: 'half', url: 'audio/third-tone/ke3-half.mp3'},
  {text: '可以', tokens: ['ke3', 'yi3'], target: 0, form: 'sandhi', url: 'audio/third-tone/ke3-sandhi.mp3'},
  {text: '理解', tokens: ['li3', 'jie3'], target: 0, form: 'sandhi', url: 'audio/third-tone/li3-sandhi.mp3'},
  {text: '马车', tokens: ['ma3', 'che1'], target: 0, form: 'half', url: 'audio/third-tone/ma3-half.mp3'},
  {text: '买单', tokens: ['mai3', 'dan1'], target: 0, form: 'half', url: 'audio/third-tone/mai3-half.mp3'},
  {text: '你好', tokens: ['ni3', 'hao3'], target: 0, form: 'sandhi', url: 'audio/third-tone/ni3-sandhi.mp3'},
  {text: '女子', tokens: ['nü3', 'zi3'], target: 0, form: 'sandhi', url: 'audio/third-tone/nv3-sandhi.mp3'},
  {text: '使用', tokens: ['shi3', 'yong4'], target: 0, form: 'half', url: 'audio/third-tone/shi3-half.mp3'},
  {text: '手机', tokens: ['shou3', 'ji1'], target: 0, form: 'half', url: 'audio/third-tone/shou3-half.mp3'},
  {text: '手表', tokens: ['shou3', 'biao3'], target: 0, form: 'sandhi', url: 'audio/third-tone/shou3-sandhi.mp3'},
  {text: '晚安', tokens: ['wan3', 'an1'], target: 0, form: 'half', url: 'audio/third-tone/wan3-half.mp3'},
  {text: '想念', tokens: ['xiang3', 'nian4'], target: 0, form: 'half', url: 'audio/third-tone/xiang3-half.mp3'},
  {text: '想法', tokens: ['xiang3', 'fa3'], target: 0, form: 'sandhi', url: 'audio/third-tone/xiang3-sandhi.mp3'},
  {text: '小吃', tokens: ['xiao3', 'chi1'], target: 0, form: 'half', url: 'audio/third-tone/xiao3-half.mp3'},
  {text: '有名', tokens: ['you3', 'ming2'], target: 0, form: 'half', url: 'audio/third-tone/you3-half.mp3'},
  {text: '雨衣', tokens: ['yu3', 'yi1'], target: 0, form: 'half', url: 'audio/third-tone/yu3-half.mp3'},
  {text: '雨伞', tokens: ['yu3', 'san3'], target: 0, form: 'sandhi', url: 'audio/third-tone/yu3-sandhi.mp3'},
  {text: '早点', tokens: ['zao3', 'dian3'], target: 0, form: 'sandhi', url: 'audio/third-tone/zao3-sandhi.mp3'},
  {text: '主人', tokens: ['zhu3', 'ren2'], target: 0, form: 'half', url: 'audio/third-tone/zhu3-half.mp3'},
  {text: '主体', tokens: ['zhu3', 'ti3'], target: 0, form: 'sandhi', url: 'audio/third-tone/zhu3-sandhi.mp3'},
  {text: '好久', tokens: ['hao3', 'jiu3'], target: 0, form: 'sandhi', url: 'audio/third-tone/hao3-sandhi.mp3'},
  {text: '理发', tokens: ['li3', 'fa4'], target: 0, form: 'half', url: 'audio/third-tone/li3-half.mp3'},
  {text: '蚂蚁', tokens: ['ma3', 'yi3'], target: 0, form: 'sandhi', url: 'audio/third-tone/ma3-sandhi.mp3'},
  {text: '女性', tokens: ['nü3', 'xing4'], target: 0, form: 'half', url: 'audio/third-tone/nv3-half.mp3'},
  {text: '大使馆', tokens: ['da4', 'shi3', 'guan3'], target: 1, form: 'sandhi', url: 'audio/third-tone/shi3-sandhi.mp3'},
  {text: '小组', tokens: ['xiao3', 'zu3'], target: 0, form: 'sandhi', url: 'audio/third-tone/xiao3-sandhi.mp3'},
  {text: '友好', tokens: ['you3', 'hao3'], target: 0, form: 'sandhi', url: 'audio/third-tone/you3-sandhi.mp3'},
  {text: '早期', tokens: ['zao3', 'qi1'], target: 0, form: 'half', url: 'audio/third-tone/zao3-half.mp3'},
];

// Bind a recording to the complete displayed example, not just its target syllable.
// A later change to the word, reading, target or form must not reuse the old audio.
export function thirdToneRecording(example: PronunciationExample, form: ThirdToneFormId): string | undefined {
  return thirdToneRecordings.find(recording =>
    recording.form === form && recording.text === example.text && recording.target === example.target &&
    recording.tokens.length === example.tokens.length && recording.tokens.every((token, i) => token === example.tokens[i]),
  )?.url;
}
