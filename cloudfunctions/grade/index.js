// AI作文批改 — 微信云函数
// 云开发环境自动注入 API Key

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '你的DeepSeek-API-Key'
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

const GRADING_PROMPT = `你是一位资深语文教师，请对以下{grade}学生的作文进行专业批改。

## 评分标准（满分100分）
- 内容（40分）：主题明确、内容充实、情感真挚
- 结构（30分）：层次清晰、过渡自然、首尾呼应
- 语言（20分）：用词准确、句式多样、修辞恰当
- 基础（10分）：无错别字、标点正确

## 批改要求
1. **逐句点评**：指出具体句子的不足，给出修改建议。至少找 3 处
2. **亮点标注**：标记写得好的句子。至少找 1 处
3. **总体评价**：80字以内
4. **错别字检查**：逐个指出错别字和正确写法

## 输出格式（严格 JSON，不要代码块标记）
{{
  "score": 85,
  "summary": "主题明确，结构完整，但细节描写不够生动...",
  "highlights": ["开头的比喻很贴切，一下子抓住了读者的注意力", "结尾的升华让文章立意更高"],
  "issues": [
    {{"sentence": "他跑的快", "suggestion": "他跑得飞快，像一阵风掠过操场", "reason": "缺'得'字，且描写平淡可增加修辞手法"}}
  ],
  "typos": [
    {{"wrong": "在见", "correct": "再见", "position": "第3段开头"}}
  ],
  "total_words": 450
}}

## 学生作文
题目：{title}
年级：{grade}

{essay}

请批改以上作文。只输出 JSON。`

// 替换模板变量（用 replace 代替 Python 的 .format）
function buildPrompt(grade, title, essay) {
  let p = GRADING_PROMPT
  // 先替换 JSON 示例中的双花括号为单花括号
  p = p.replace(/{{/g, '{').replace(/}}/g, '}')
  // 然后替换实际占位符
  p = p.replace(/\{grade\}/g, grade)
  p = p.replace(/\{title\}/g, title)
  p = p.replace(/\{essay\}/g, essay)
  return p
}

// 调用 DeepSeek API
async function callDeepSeek(prompt) {
  const resp = await cloud.openapi.cloudbase.request({
    url: DEEPSEEK_URL,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    data: {
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.3
    }
  })
  return resp.data.choices[0].message.content
}

// 解析 AI 返回的 JSON
function parseResult(raw) {
  let text = raw.trim()
  // 去掉代码块标记
  if (text.startsWith('```')) {
    const lines = text.split('\n')
    text = lines.slice(1).join('\n')
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3)
  }
  text = text.trim()

  try {
    return JSON.parse(text)
  } catch (e) {
    // 容错：提取 JSON 子串
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}') + 1
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end))
    }
    throw e
  }
}

// 云函数入口
exports.main = async (event, context) => {
  const { essay, grade = '小学', title = '无' } = event

  // 参数校验
  if (!essay || essay.length < 50) {
    return { error: '作文至少50字' }
  }
  if (essay.length > 5000) {
    return { error: '作文不超过5000字' }
  }

  try {
    const prompt = buildPrompt(grade, title, essay)
    const raw = await callDeepSeek(prompt)
    const result = parseResult(raw)

    return {
      score: parseInt(result.score) || 0,
      summary: result.summary || '批改完成',
      highlights: result.highlights || [],
      issues: result.issues || [],
      typos: result.typos || [],
      total_words: parseInt(result.total_words) || 0
    }
  } catch (err) {
    return { error: err.message || '批改失败，请重试' }
  }
}
