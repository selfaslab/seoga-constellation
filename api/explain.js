/**
 * /api/explain — 주제명 해설 생성 (Google Gemini API)
 *
 * 인증키를 서버에만 두고 클라이언트에는 노출하지 않습니다.
 *
 * 필요한 Vercel 환경변수
 *   GEMINI_API_KEY   (필수)  Google AI Studio 에서 발급
 *   GEMINI_MODEL     (선택)  기본값 gemini-2.5-flash
 *
 * 원고 <표 11> API 중계 계층 / <표 12> AI 사용 내역에 해당하는 구현입니다.
 */

const DEFAULT_MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 20000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: "서버에 GEMINI_API_KEY 가 설정되지 않았습니다.",
      hint: "Vercel → Settings → Environment Variables 등록 후 재배포",
    });
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const { label, books, structure, gaps } = req.body || {};
  if (!label) {
    return res.status(400).json({ error: "주제명이 필요합니다." });
  }

  const prompt = `당신은 국립중앙도서관 주제명 전거를 검토하는 사서입니다.
아래 주제명 노드를 한국어로 3문장 이내로 해설하세요.

주제명: ${label}
부여 도서: ${Number(books || 0).toLocaleString()}권
전거 구조상 연결된 주제명: ${structure && structure.length ? structure.join(", ") : "없음"}
함께 부여되나 구조 연결이 없는 주제명: ${gaps && gaps.length ? gaps.join(", ") : "없음"}

지침
- 첫 문장은 이 주제명이 무엇을 가리키는지 설명한다.
- 이후 문장은 전거 구조상의 연결과 실제 부여 이력이 어긋나는 이유를 추정하되, 추정임을 문장에 드러낸다.
- 위에 주어진 정보 밖의 서지사항이나 수치를 새로 만들지 않는다.
- 단정적 사실 주장을 하지 않는다. 머리말 없이 본문만 출력한다.`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(url, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(r.status).json({
        error:
          r.status === 404
            ? `모델 '${model}' 을 찾을 수 없습니다. GEMINI_MODEL 환경변수를 확인하십시오.`
            : "해설 생성 요청이 거부되었습니다.",
        status: r.status,
        detail: detail.slice(0, 300),
      });
    }

    const data = await r.json();

    if (data.promptFeedback && data.promptFeedback.blockReason) {
      return res.status(200).json({
        text: "이 주제명에 대한 해설은 생성되지 않았습니다.",
        blocked: true,
      });
    }

    const text = ((data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts) || [])
      .map((p) => p.text || "")
      .join("")
      .trim();

    return res.status(200).json({ text, model });
  } catch (e) {
    const aborted = e.name === "AbortError";
    return res.status(aborted ? 504 : 500).json({
      error: aborted ? "응답 시간이 초과되었습니다." : "해설을 불러오지 못했습니다.",
    });
  } finally {
    clearTimeout(timer);
  }
}
