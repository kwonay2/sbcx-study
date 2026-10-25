   // GET /api/admin/data — 응답 목록·동의 기록·설정·추첨 번호 개수
   import { send, route } from '../../lib/http.js';
   import { requireAdmin } from '../../lib/auth.js';
   import { callStore } from '../../lib/store.js';

   export default route(['GET'], async (req, res) => {
     requireAdmin(req);
     const d = await callStore('admin_data', {});
     send(res, 200, {
       ok: true,
       responses: d.responses,
       consents: d.consents,
       consentTexts: d.consentTexts,
       settings: d.settings,
       phoneCount: d.phoneCount,
       sheetUrl: d.sheetUrl,
       phoneUrl: d.phoneUrl,
       now: d.now || Date.now(),
       storage: process.env.APPS_SCRIPT_URL ? 'google' : 'local'
     });
   });
