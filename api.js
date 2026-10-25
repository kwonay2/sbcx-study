// 참가자 화면 → 서버(/api) 호출

async function postJson(url, body, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok || !data || !data.ok) {
      const err = new Error((data && data.error) || `서버 오류 (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function assign(payload) {
  return postJson('/api/assign', payload, 30000);
}

export function save(payload) {
  return postJson('/api/save', payload);
}

export function sendPhone(id, phone) {
  return postJson('/api/phone', { id, phone });
}

// 창을 닫거나 다른 탭으로 갈 때: 응답을 기다리지 않고 보낸다
export function beacon(payload) {
  try {
    if (!navigator.sendBeacon) return false;
    return navigator.sendBeacon('/api/save', new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=utf-8' }));
  } catch {
    return false;
  }
}

export function deviceLabel() {
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua)
    ? 'Edge'
    : /Whale\//.test(ua)
      ? 'Whale'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '기타';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '기타 OS';
  return `${b} · ${os} · 화면 ${window.screen.width}×${window.screen.height}`;
}

export function isMobileUA() {
  return /iPhone|iPod|Android.+Mobile|Windows Phone/.test(navigator.userAgent);
}
