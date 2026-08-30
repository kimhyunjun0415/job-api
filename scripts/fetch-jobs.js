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

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
let seen = [];
try { seen = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8')); } catch(e){ seen = []; }
const seenSet = new Set(seen);

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
      if(seenSet.has(full)) return;
      // Heuristic: include if text contains one of keywords or url contains some job-like path
      const textLower = text.toLowerCase();
      const matchesKw = keywords.some(k => textLower.includes(k.replace(/\s+/g,'').toLowerCase()) || text.toLowerCase().includes(k.toLowerCase()));
      const jobLike = /recruit|view|job|vacancy|position|채용|공고|채용공고/.test(full.toLowerCase()) || /채용|공고|모집|채용정보/.test(text);
      if(matchesKw || jobLike){
        found.push({ title: text.replace(/\s+/g,' '), url: full, site: site.name });
      }
    });
    // small delay between keyword requests
    await new Promise(r => setTimeout(r, 500));
  }
  // dedupe by url
  const uniq = [];
  const s = new Set();
  for(const f of found){ if(!s.has(f.url)){ s.add(f.url); uniq.push(f); } }
  return uniq.slice(0, 10);
}

async function sendOneSignalNotification(item){
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if(!appId || !apiKey){
    console.warn('OneSignal credentials not set, skipping send (set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY).');
    return { ok: false, reason: 'no-credentials' };
  }
  const body = {
    app_id: appId,
    headings: { en: `${item.site} · 신규 공고` },
    contents: { en: item.title },
    included_segments: ["All"],
    url: item.url,
    data: { url: item.url }
  };
  try{
    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8', 'Authorization': `Basic ${apiKey}` },
      body: JSON.stringify(body)
    });
    const j = await res.json();
    if(!res.ok){
      console.error('OneSignal send failed', j);
      return { ok:false, status: res.status, body: j };
    }
    console.log('Sent OneSignal', j);
    return { ok:true, body:j };
  }catch(e){
    console.error('Error sending OneSignal', e.message);
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
        if(seenSet.has(it.url)) continue;
        console.log('New item:', it.title, it.url);
        // send notification
        const result = await sendOneSignalNotification(it);
        if(result.ok){
          seenSet.add(it.url);
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
