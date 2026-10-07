"""Extract compact, attributable pronunciation examples from CC-CEDICT.
No definitions are redistributed. Run from any directory with Python 3.10+.
"""
from pathlib import Path
import gzip
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'
cache = ROOT / 'work' / 'cedict.txt.gz'
cache.parent.mkdir(exist_ok=True)
if not cache.exists():
    with urllib.request.urlopen(URL, timeout=90) as response:
        cache.write_bytes(response.read())
raw = gzip.decompress(cache.read_bytes()).decode('utf-8')
entries = []
readings = {}
for line in raw.splitlines():
    match = re.match(r'\S+ (\S+) \[([^\]]+)\] /(.*)/$', line)
    if not match:
        continue
    word, pinyin, gloss = match.groups()
    tokens = pinyin.lower().replace('u:', 'ü').split()
    if len(word) != len(tokens) or not 1 <= len(word) <= 3:
        continue
    if not all(re.fullmatch(r'[a-züê]+[1-5]', t) for t in tokens):
        continue
    if not all('\u4e00' <= c <= '\u9fff' for c in word):
        continue
    if len(word) == 1:
        readings.setdefault(word, set()).add(tokens[0])
    entries.append((word, tokens, gloss, pinyin))

common = '的一是不了人我在有他这为之大来以个中上们到说国和地也子时道出而要于就下得可你年生自会那后能对着事其里所去行过家十用发天如然作方成者多日都三小二无同经法当起与好看学进种将还分此心前面又定见只主没公从知全工使情明性老被动等开把长常正外己战关理新想实水很它西南北东手本高更内着先给数式点力花明女男月山白红黑妈麻马骂吗宣悬选炫军均俊云允运居局举巨区渠取趣需徐许续元远院约月雨鱼语玉牛久九酒六流留论轮伦绿吕率略女虐书树谁水睡春唇蠢顺真陈神人怎森听天桌椅衣服朋友东西妈妈爸爸哥哥姐姐弟弟妹妹孩子时候什么我们你们他们'.replace(' ','')
rank = {c:i for i,c in enumerate(dict.fromkeys(common))}
blocked = re.compile(r'variant of|old variant|archaic|obsolete|dialect|Taiwan pr\.|surname|used in names|transliteration|vulgar|slang', re.I)
candidates = {}
for word, tokens, gloss, original in entries:
    if blocked.search(gloss) or any(c.isupper() for c in original):
        continue
    for i, token in enumerate(tokens):
        # A neutral tone is meaningful in context; never synthesize an isolated neutral syllable.
        if token.endswith('5') and len(word) == 1:
            continue
        if len(word) == 1 and len(readings[word]) != 1:
            continue
        score = (0 if len(word)==1 else 400) + (len(word)-1)*80 + sum(rank.get(c,1200) for c in word)/len(word)
        # Avoid a preceding third tone for a target third tone (tone sandhi).
        if token.endswith('3') and i and tokens[i-1].endswith('3'):
            score += 1000
        candidates.setdefault(token, []).append((score,word,tokens,i))

examples = {}
for token, options in candidates.items():
    _, word, tokens, i = min(options)
    examples[token] = {'text':word,'tokens':tokens,'target':i}

# Familiar examples take precedence. Every override is verified against this dictionary.
preferred = {
 'ma1':'妈', 'ma2':'麻', 'ma3':'马', 'ma4':'骂', 'ma5':'妈妈',
 'dun1':'蹲','dun3':'盹','dun4':'顿','nü3':'女','nü4':'女',
 'gui1':'归','gui3':'鬼','gui4':'贵',
 'liu1':'溜','liu2':'流','liu3':'柳','liu4':'六',
 'lü2':'驴','lü3':'吕','lü4':'绿','lüe4':'略',
 'ba1':'八','ba2':'拔','ba3':'把','ba4':'爸','pa1':'趴','pa2':'爬','pa4':'怕',
 'da1':'搭','da2':'答','da3':'打','da4':'大','ta1':'他','ta3':'塔','ta4':'踏',
 'na2':'拿','na3':'哪','na4':'那','la1':'拉','la4':'辣',
 'ji1':'鸡','ji2':'急','ji3':'几','ji4':'记','qi1':'七','qi2':'旗','qi3':'起','qi4':'气',
 'xi1':'西','xi2':'习','xi3':'洗','xi4':'戏','zhi1':'知','zhi2':'直','zhi3':'纸','zhi4':'至',
 'chi1':'吃','chi2':'池','chi3':'尺','chi4':'赤','shi1':'诗','shi2':'十','shi3':'使','shi4':'是',
 'ri4':'日','zi1':'资','zi3':'紫','zi4':'字','ci2':'词','ci3':'此','ci4':'次','si1':'思','si3':'死','si4':'四',
 'xuan1':'宣', 'xuan2':'悬', 'xuan3':'选', 'xuan4':'炫',
 'jun1':'军','jun4':'俊','xun1':'熏','xun2':'寻','xun4':'训',
 'de5':'好的','le5':'好了','zi5':'孩子','men5':'我们','me5':'什么',
 'ba5':'爸爸','ge5':'哥哥','jie5':'姐姐','di5':'弟弟','mei5':'妹妹',
 'peng2':'朋','you5':'朋友','xi5':'东西','fu5':'衣服','shang5':'晚上',
 'hou5':'时候','tou5':'石头','li5':'哪里','sheng5':'学生','liang5':'漂亮',
 'chu5':'好处','hu5':'老虎','huo5':'快活','jing5':'眼睛','qing5':'事情',
 'bo5':'萝卜','niang5':'姑娘','zhe5':'看着',
}
for token, word in preferred.items():
    match = next(((w,ts,len(ts)-1-ts[::-1].index(token)) for w,ts,g,o in entries if w==word and token in ts),None)
    if match:
        w,ts,i = match
        examples[token] = {'text':w,'tokens':ts,'target':i}

# Selected comparison words; no automatic sandhi inference from arbitrary text.
# Each spelling/readout is verified against the same source dictionary.
third_choices = {
 'hao3': ('好', '好吃', '好友'),
 'lao3': ('老', '老师', '老板'),
 'xiao3': ('小', '小吃', '小雨'),
 'mai3': ('买', '买单', '买主'),
 'shui3': ('水', '水平', '水果'),
 'yu3': ('雨', '雨衣', '雨伞'),
 'li3': ('理', '理科', '理解'),
 'ke3': ('可', '可惜', '可以'),
 'dian3': ('点', '点名', '点火'),
 'shou3': ('手', '手机', '手表'),
 'zao3': ('早', '早晨', '早点'),
 'wan3': ('晚', '晚安', '晚点'),
 'you3': ('有', '有名', '有理'),
 'ma3': ('马', '马车', '马匹'),
 'nü3': ('女', '女生', '女子'),
 'zhu3': ('主', '主人', '主体'),
 'ni3': ('你', None, '你好'),
 'fa3': ('法', '法国', '法语'),
 'shi3': ('使', '使用', '使馆'),
 'xiang3': ('想', '想念', '想法'),
 'zhun3': ('准', '准备', '准许'),
}
third_examples = {}
for token, words in third_choices.items():
    forms = {}
    for form, word in zip(('full', 'half', 'sandhi'), words):
        if word is None:
            continue
        def fits(ts):
            if ts[0] != token:
                return False
            if form == 'full':
                return len(ts) == 1
            return len(ts) == 2 and ts[1][-1] in ('124' if form == 'half' else '3')
        match = next(((w, ts) for w, ts, g, o in entries if w == word and fits(ts)), None)
        if match is None:
            raise ValueError(f'Third-tone example not verified in CC-CEDICT: {token}/{form}/{word}')
        w, ts = match
        forms[form] = {'text': w, 'tokens': ts, 'target': 0}
    third_examples[token] = forms

data = {
 'meta': {'source':'CC-CEDICT / MDBG', 'url':URL, 'license':'CC BY-SA 4.0',
          'licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/',
          'retrieved':datetime.now(timezone.utc).strftime('%Y-%m-%d'),
          'sha256':hashlib.sha256(cache.read_bytes()).hexdigest(),
          'changes':'Selected simplified headwords and readings; definitions omitted; example ranking, curated overrides and third-tone comparison words added.'},
 'examples': dict(sorted(examples.items())),
 'thirdToneExamples': dict(sorted(third_examples.items())),
}
(ROOT/'public'/'examples.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Generated {len(examples)} syllable-tone examples.')
print(f'Verified {sum(len(forms) for forms in third_examples.values())} third-tone comparison examples for {len(third_examples)} syllables.')
