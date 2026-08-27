/**
 * /api/health — 배포 진단용
 * 브라우저에서 https://<주소>/api/health 로 직접 열어보십시오.
 *
 *  JSON 이 보이면      → 서버리스 함수 정상 배포됨
 *  404 페이지가 보이면 → 함수가 배포되지 않음 (api 폴더 위치·커밋 확인)
 */
module.exports = function handler(req, res) {
  const key = process.env.GEMINI_API_KEY;
  res.status(200).json({
    ok: true,
    functionDeployed: true,
    hasKey: Boolean(key),
    keyPrefix: key ? key.slice(0, 6) + "..." : null,
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    nodeVersion: process.version,
    checkedAt: new Date().toISOString(),
  });
}
