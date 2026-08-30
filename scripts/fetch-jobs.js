// Node 18 환경엔 File 전역이 없는데, undici(cheerio/node-fetch 의존성)가 모듈 로드 시점에
// 이를 참조해서 즉시 크래시하는 경우가 있어 미리 채워둔다. (Node 20+는 이미 전역에 있어 no-op)
if (typeof File === 'undefined') {
  global.File = require('buffer').File;
}

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// --- fetch 폴백 처리 (Node 환경에서 global.fetch가 없을 때 node-fetch 사용) ---
async function ensureFetchAvailable() {
  if (typeof fetch !== 'undefined') return;
  try {
    const mod = await import('node-fetch');
    // node-fetch default export 함수 할당
    global.fetch = mod.default || mod;
    console.log('Using node-fetch polyfill for fetch');
  } catch (e) {
    console.error('fetch is not available and node-fetch failed to load:', e.message);
    process.exit(1);
  }
}

const CONFIG_PATH = path.join(__dirname, 'config.json');
const SEEN_PATH = path.join(process.cwd(), 'data', 'seen.json');
// 평소엔 사이트당 10개로 알림 폭탄을 막고, 밀린 걸 한 번에 정리하고 싶을 땐
// Actions에서 수동 실행하며 max_per_site 입력값(MAX_PER_SITE)을 크게 주면 된다.
const MAX_PER_SITE = parseInt(process.env.MAX_PER_SITE, 10) || 10;

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
let seen = [];
try { seen = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')); } catch(e){ seen = []; }
const seenSet = new Set(seen.map(dedupKey));

function buildUrl(tpl, kw){
  return tpl.replace('{kw}', encodeURIComponent(kw));
}

async function fetchPage(url){
  try{
    const res = await fetch(url, { headers: { 'User-Agent': 'github-actions-job-scraper/1.0' }});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }catch(e){
    console.error('Failed to fetch', url, e.message);
    return null;
  }
}

function absoluteUrl(base, href){
  try{ return new URL(href, base).toString(); }catch(e){ return null; }
}

// 검색 컨텍스트를 실어나르는 추적 파라미터(검색어, 정렬, 클릭 로그, 세션 UUID 등)는
// 같은 공고인데도 검색할 때마다 값이 새로 생겨서 "URL 통째로 비교" 방식으로는 중복을
// 절대 못 잡는다 (예: 사람인 search_uuid는 매 요청마다 랜덤). 그래서 파라미터를
// 하나하나 걸러내는 대신, URL에서 공고를 실제로 구분하는 ID만 뽑아서 비교한다.
const VOLATILE_PARAMS = [
  'logpath','sc','listno','searchRow','searchKeyword','stext','keyword','query',
  'Oem_Code','utm_source','utm_medium','utm_campaign','utm_content','utm_term'
];
// 공고 ID가 쿼리 파라미터로 들어있는 사이트 (예: 사람인 ?rec_idx=12345)
const ID_PARAMS = ['rec_idx', 'idx', 'job_id'];

function dedupKey(urlStr){
  try{
    const u = new URL(urlStr);

    // 1) 알려진 ID 파라미터가 있으면 그 값만으로 키를 만든다 (다른 파라미터는 전부 무시).
    //    이 함수가 만들어낸 키(#rec_idx=123 형태)를 seen.json에서 다시 불러와 같은
    //    함수에 또 넣는 경우도 있으므로, 쿼리뿐 아니라 해시도 같이 확인해야 한다 -
    //    안 그러면 저장된 키를 다시 정규화할 때 해시가 통째로 날아가면서 ID가 사라지고
    //    모든 항목이 같은 값으로 뭉개져 버린다 (실제로 이 버그로 중복 알림이 났었음).
    let idParam = ID_PARAMS.find(p => u.searchParams.has(p));
    let idValue = idParam ? u.searchParams.get(idParam) : null;
    if(!idValue && u.hash){
      const m = u.hash.slice(1).match(/^([a-zA-Z_]+)=(.+)$/);
      if(m && ID_PARAMS.includes(m[1])){
        idParam = m[1];
        idValue = decodeURIComponent(m[2]);
      }
    }
    if(idValue){
      return `${u.origin}${u.pathname}#${idParam}=${idValue}`;
    }

    // 2) 경로 자체에 공고 ID가 들어있는 사이트 (예: /Recruit/GI_Read/49826539,
    //    /jobs/detail/118777040) - 경로엔 추적값이 안 붙으니 경로만으로 충분하다.
    const hasNumericSegment = u.pathname.split('/').some(seg => /^\d{4,}$/.test(seg));
    if(hasNumericSegment){
      return `${u.origin}${u.pathname}`;
    }

    // 3) 그 외엔 알려진 추적 파라미터만 제거하고 나머지로 비교 (최후 수단).
    VOLATILE_PARAMS.forEach(p => u.searchParams.delete(p));
    u.searchParams.sort();
    u.hash = '';
    return u.toString();
  }catch(e){
    return urlStr;
  }
}

async function scrapeSite(site, keywords){
  if(!site.urlTpl){ console.log(`Skipping ${site.name} (no URL template)`); return []; }
  const found = [];
  for(const kw of keywords){
    const url = buildUrl(site.urlTpl, kw);
    console.log(`Fetching ${site.name} -> ${url}`);
    const html = await fetchPage(url);
    if(!html) continue;
    const $ = cheerio.load(html);
    $('a').each((i, el) => {
      const text = ($(el).text() || '').trim();
      const href = $(el).attr('href');
      if(!href) return;
      const full = absoluteUrl(url, href);
      if(!full) return;
      // Basic heuristics: text length and not just navigation
      if(text.length < 6) return;
      // Avoid search pagination and anchors
      if(full.includes('#') && text.length < 30) return;
      // Simple de-dup by URL
      if(seenSet.has(dedupKey(full))) return;
      // 키워드가 실제로 링크 텍스트에 들어있는 것만 채용공고 후보로 본다.
      // ("채용/공고/recruit 등 그럴듯한 단어가 있으면 통과"하던 예전 기준은 랩핑/PPF랑
      // 전혀 상관없는 메뉴·배너 링크까지 잡아서 쓸데없는 알림의 원인이었다.)
      const textLower = text.toLowerCase();
      const matchesKw = keywords.some(k => textLower.includes(k.replace(/\s+/g,'').toLowerCase()) || textLower.includes(k.toLowerCase()));
      if(matchesKw){
        found.push({ title: text.replace(/\s+/g,' '), url: full, site: site.name });
      }
    });
    // small delay between keyword requests
    await new Promise(r => setTimeout(r, 500));
  }
  // dedupe by normalized url (같은 공고가 키워드별로 두 번 잡히는 것 방지)
  const uniq = [];
  const s = new Set();
  for(const f of found){
    const k = dedupKey(f.url);
    if(!s.has(k)){ s.add(k); uniq.push(f); }
  }
  return uniq.slice(0, MAX_PER_SITE);
}

async function sendNtfyNotification(item){
  const topic = process.env.NTFY_TOPIC;
  if(!topic){
    console.warn('NTFY_TOPIC not set, skipping send.');
    return { ok: false, reason: 'no-topic' };
  }
  try{
    const res = await fetch('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        topic,
        title: `${item.site} · 신규 공고`,
        message: item.title,
        click: item.url
      })
    });
    if(!res.ok){
      const t = await res.text();
      console.error('ntfy send failed', res.status, t);
      return { ok:false, status: res.status };
    }
    console.log('Sent ntfy notification:', item.title);
    return { ok:true };
  }catch(e){
    console.error('Error sending ntfy notification', e.message);
    return { ok:false, reason: e.message };
  }
}

(async ()=>{
  await ensureFetchAvailable();

  const keywords = config.keywords || ['차량 랩핑','PPF'];
  const sites = config.sites || [];
  const allNew = [];
  for(const site of sites){
    try{
      const items = await scrapeSite(site, keywords);
      console.log(`Found ${items.length} candidate(s) on ${site.name}`);
      for(const it of items){
        if(seenSet.has(dedupKey(it.url))) continue;
        console.log('New item:', it.title, it.url);
        // send notification
        const result = await sendNtfyNotification(it);
        if(result.ok){
          seenSet.add(dedupKey(it.url));
          allNew.push(it);
        }
        // small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 800));
      }
    }catch(e){ console.error('Error scraping site', site.name, e.message); }
  }

  // write back seen list if any new
  if(allNew.length > 0){
    const arr = Array.from(seenSet);
    fs.mkdirSync(path.dirname(SEEN_PATH), { recursive: true });
    fs.writeFileSync(SEEN_PATH, JSON.stringify(arr, null, 2), 'utf8');
    console.log(`Saved ${allNew.length} new items to seen.json`);
  } else {
    console.log('No new items found.');
  }
})();
