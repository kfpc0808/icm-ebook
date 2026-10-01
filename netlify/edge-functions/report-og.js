/* ★ [2026-10-01] 브로슈어 리포트 — 카카오톡 등 링크 미리보기(OG)에 리포트 제목·전문위원 이름을 넣는다
   · 대상 주소: ebook.icm.re.kr/{아이디}/report?r={리포트 id}   (_redirects 가 _common/report.html 로 연결)
   · 미리보기를 읽으러 오는 수집기(카카오톡·페이스북·텔레그램·슬랙 등)에게만 동작한다 → 실제 고객 화면은 영향 없음(지연 없음)
   · 서버 함수 brochureReport 를 count:false 로 불러 열람 수는 올리지 않는다
   · 실패하거나 2.5초 안에 응답이 없으면 report.html 의 기본 미리보기(ICM INSIGHT · 전문위원 리포트)를 그대로 쓴다 */
const API = 'https://asia-northeast3-jarvia-platform.cloudfunctions.net/brochureReport';
const BOT = /kakaotalk-scrap|facebookexternalhit|facebot|twitterbot|slackbot|telegrambot|whatsapp|discordbot|linkedinbot|line-poker|yeti|daum|bingbot|googlebot|bot\b|crawler|spider|preview/i;

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cut(s, n){ s = String(s || '').replace(/\s+/g,' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

export default async (request, context) => {
  const res = await context.next();
  try{
    if (!BOT.test(request.headers.get('user-agent') || '')) return res;
    if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
    const url = new URL(request.url);
    const id = decodeURIComponent((url.pathname.split('/').filter(Boolean)[0]) || '');
    const r = url.searchParams.get('r') || '';
    if (!/^[A-Za-z0-9._-]{2,40}$/.test(id) || !/^[A-Za-z0-9_-]{6,40}$/.test(r)) return res;

    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 2500);
    let d = null;
    try{
      const api = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ data:{ id, r, count:false } }), signal: ctl.signal });
      const js = await api.json(); d = js && js.result;
    } finally { clearTimeout(timer); }
    if (!d || d.ok !== true || !d.report) return res;

    const rep = d.report, name = String((d.author && d.author.name) || '').trim();
    const title = cut(rep.title, 60);
    const desc = cut((name ? name + ' 전문위원 · ' : '') + 'ICM 기업경영연구소 | ' + (rep.summary || ''), 150);
    const og = '<title>' + esc(title) + ' · ICM INSIGHT</title>\n'
      + '<meta property="og:type" content="article">\n'
      + '<meta property="og:site_name" content="ICM 기업경영연구소">\n'
      + '<meta property="og:title" content="' + esc(title) + '">\n'
      + '<meta property="og:description" content="' + esc(desc) + '">\n'
      + '<meta property="og:image" content="' + esc(url.origin + '/_common/files/og-report.jpg') + '">\n'
      + '<meta property="og:image:width" content="1200">\n'
      + '<meta property="og:image:height" content="630">\n'
      + '<meta name="description" content="' + esc(desc) + '">\n'
      + '<meta name="twitter:card" content="summary_large_image">';
    const html = await res.text();
    const out = html.replace(/<!--og:s-->[\s\S]*?<!--og:e-->/, '<!--og:s-->' + og + '<!--og:e-->');
    const h = new Headers(res.headers); h.delete('content-length'); h.set('content-type', 'text/html; charset=UTF-8');
    return new Response(out, { status: res.status, headers: h });
  }catch(_){
    return res;
  }
};

export const config = { path: '/*/report' };
