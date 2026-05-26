# AI作文批改 小程序 — 实施方案

> **Goal:** 微信小程序，家长/学生提交作文 → AI 打分+逐句批注+修改建议 → 按次或包月收费

**Architecture:** 微信小程序(前端) + Python FastAPI(后端) + DeepSeek API(AI) + 微信支付(变现)

**Tech Stack:** 微信小程序原生框架 / Python FastAPI / DeepSeek V4 / 微信支付 JSAPI

**原则:** 先做最简单能跑通的版本，不要过度设计。V1 用户手动输入文本（不做OCR），后端最小化。

---

## 总体规划：3 个 Phase，约 3-5 天

### Phase 1 — 核心闭环（今天~明天）
搭建后端 + 小程序框架 + AI 批改功能跑通

### Phase 2 — 支付变现（后天）
微信支付接入 + 会员体系 + 历史记录

### Phase 3 — 体验优化
OCR 拍照识别、范文库、分享裂变

---

## Phase 1: 核心闭环

### 任务 1: 项目初始化

**目标:** 创建项目目录结构，初始化后端和小程序

**目录结构:**
```
ai-essay-grader/
├── backend/                  # Python FastAPI 后端
│   ├── main.py              # 入口，路由
│   ├── requirements.txt     # fastapi uvicorn httpx
│   ├── config.py            # API key 等配置
│   └── prompts.py           # AI 批改 prompt
├── miniapp/                  # 微信小程序前端
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── project.config.json
│   └── pages/
│       ├── index/           # 首页：提交作文
│       │   ├── index.wxml
│       │   ├── index.wxss
│       │   ├── index.js
│       │   └── index.json
│       └── result/          # 结果页：批改展示
│           ├── result.wxml
│           ├── result.wxss
│           ├── result.js
│           └── result.json
└── docs/
    └── plans/
```

**操作:**
```bash
mkdir -p backend miniapp/pages/index miniapp/pages/result docs/plans
```

### 任务 2: 后端 — FastAPI 骨架

**目标:** 创建能跑起来的 FastAPI 服务器，一个 `/api/grade` 端点

**文件:** `backend/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "your-key-here")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1/chat/completions"

class GradeRequest(BaseModel):
    essay: str
    grade: str = "小学"  # 小学/初中/高中
    title: str = ""

class GradeResponse(BaseModel):
    score: int
    max_score: int = 100
    summary: str
    highlights: list[str]
    issues: list[dict]  # [{original, suggestion, reason}]
    total_words: int

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/grade")
async def grade_essay(req: GradeRequest):
    # TODO: 调用 DeepSeek 批改
    return {"status": "not implemented"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3456)
```

**文件:** `backend/requirements.txt`
```
fastapi==0.115.0
uvicorn==0.30.0
httpx==0.27.0
```

### 任务 3: AI 批改 Prompt

**目标:** 写出高质量的批改 prompt，让 AI 返回结构化结果

**文件:** `backend/prompts.py`
```python
GRADING_PROMPT = """你是一位资深语文教师，请对以下{grade}学生的作文进行专业批改。

## 评分标准（满分{max_score}分）
- 内容（40%）：主题明确、内容充实、情感真挚
- 结构（30%）：层次清晰、过渡自然、首尾呼应
- 语言（20%）：用词准确、句式多样、修辞恰当
- 卷面（10%）：无错别字、标点正确、书写规范

## 批改要求
1. **逐句点评**：指出具体句子的问题，给出修改建议
2. **亮点标注**：标记写得好的句子
3. **总体评价**：80字以内
4. **错别字**：逐个指出

## 输出格式（严格JSON，不要markdown代码块）
{
  "score": 85,
  "summary": "文章主题明确，结构完整，但细节描写不够生动...",
  "highlights": ["开头的比喻很贴切", "结尾升华有力度"],
  "issues": [
    {"original": "他跑的快", "suggestion": "他跑得飞快，像一阵风掠过操场", "reason": "缺'得'字，且描写平淡可增加修辞"}
  ],
  "typos": [
    {"wrong": "在见", "correct": "再见", "position": "第3段"}
  ],
  "total_words": 450
}

## 学生作文
题目：{title}
年级：{grade}

{essay}

请批改以上作文。只输出JSON，不要任何其他文字。"""
```

### 任务 4: 后端 — 接入 DeepSeek 批改

**目标:** 完善 `/api/grade` 端点，调用 DeepSeek 并解析返回结果

**修改:** `backend/main.py`
```python
from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL
from prompts import GRADING_PROMPT

@app.post("/api/grade")
async def grade_essay(req: GradeRequest):
    prompt = GRADING_PROMPT.format(
        grade=req.grade,
        title=req.title or "无",
        essay=req.essay,
        max_score=100
    )
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            DEEPSEEK_BASE_URL,
            headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}"},
            json={
                "model": "deepseek-v4-flash",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4096,
                "temperature": 0.3
            }
        )
        data = resp.json()
    
    content = data["choices"][0]["message"]["content"].strip()
    # 清理可能的 markdown 代码块
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        if content.endswith("```"):
            content = content[:-3]
    
    import json
    result = json.loads(content)
    return result
```

### 任务 5: 小程序 — 项目配置

**目标:** 创建小程序核心配置文件

**文件:** `miniapp/app.json`
```json
{
  "pages": [
    "pages/index/index",
    "pages/result/result"
  ],
  "window": {
    "navigationBarTitleText": "AI作文批改",
    "navigationBarBackgroundColor": "#4F46E5",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#F5F5F5"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

**文件:** `miniapp/app.js`
```javascript
App({
  globalData: {
    server: 'http://192.168.x.x:3456'  // 开发时改成实际IP
  },
  
  api(path, opts = {}) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.globalData.server + '/api' + path,
        method: opts.method || 'GET',
        data: opts.body,
        header: { 'Content-Type': 'application/json' },
        success: res => {
          if (res.statusCode === 200) resolve(res.data)
          else reject(new Error(res.data?.detail || '请求失败'))
        },
        fail: reject
      })
    })
  }
})
```

**文件:** `miniapp/project.config.json`
```json
{
  "description": "AI作文批改小程序",
  "packOptions": { "ignore": [] },
  "setting": {
    "urlCheck": false,
    "es6": true,
    "postcss": true,
    "minified": true
  },
  "compileType": "miniprogram",
  "appid": "your-appid-here",
  "projectname": "ai-essay-grader",
  "miniprogramRoot": "miniapp/"
}
```

### 任务 6: 小程序 — 首页（提交作文）

**目标:** 首页表单：标题输入 + 年级选择 + 作文正文输入 + 提交按钮

**文件:** `miniapp/pages/index/index.wxml`
```xml
<view class="container">
  <view class="hero">
    <text class="hero-icon">📝</text>
    <text class="hero-title">AI 作文批改</text>
    <text class="hero-desc">拍照或输入作文，秒出批改结果</text>
  </view>

  <view class="form">
    <input class="input" placeholder="作文题目（可选）" bindinput="onTitleInput" value="{{title}}" />
    
    <view class="grade-row">
      <view class="grade-item {{grade === '小学' ? 'active' : ''}}" bindtap="selectGrade" data-grade="小学">小学</view>
      <view class="grade-item {{grade === '初中' ? 'active' : ''}}" bindtap="selectGrade" data-grade="初中">初中</view>
      <view class="grade-item {{grade === '高中' ? 'active' : ''}}" bindtap="selectGrade" data-grade="高中">高中</view>
    </view>

    <view class="textarea-wrap">
      <textarea class="textarea" 
        placeholder="请输入作文内容（至少50字）" 
        bindinput="onEssayInput" 
        value="{{essay}}"
        maxlength="5000"
        auto-height
      />
      <text class="word-count">{{essay.length}}字</text>
    </view>

    <button class="btn-submit" 
      bindtap="submitEssay" 
      disabled="{{essay.length < 50}}"
      loading="{{loading}}"
    >
      {{loading ? 'AI批改中...' : '开始批改'}}
    </button>
  </view>
</view>
```

**文件:** `miniapp/pages/index/index.js`
```javascript
const app = getApp()

Page({
  data: {
    title: '',
    grade: '小学',
    essay: '',
    loading: false
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }) },
  onEssayInput(e) { this.setData({ essay: e.detail.value }) },

  selectGrade(e) {
    this.setData({ grade: e.currentTarget.dataset.grade })
  },

  async submitEssay() {
    const { essay, grade, title } = this.data
    if (essay.length < 50) {
      wx.showToast({ title: '作文至少50字', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      const result = await app.api('/grade', {
        method: 'POST',
        body: { essay, grade, title }
      })
      
      // 跳转结果页
      wx.navigateTo({
        url: '/pages/result/result?data=' + encodeURIComponent(JSON.stringify(result))
      })
    } catch (err) {
      wx.showToast({ title: err.message || '批改失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
```

### 任务 7: 小程序 — 结果页

**目标:** 展示 AI 批改结果：分数、总评、逐句点评、错别字

**文件:** `miniapp/pages/result/result.wxml`
```xml
<view class="container">
  <!-- 分数卡片 -->
  <view class="score-card">
    <text class="score-num">{{result.score}}</text>
    <text class="score-max">/100</text>
    <text class="score-grade">{{scoreGrade}}</text>
  </view>

  <!-- 总评 -->
  <view class="section">
    <view class="section-title">📋 总体评价</view>
    <text class="summary-text">{{result.summary}}</text>
    <text class="word-count">共 {{result.total_words}} 字</text>
  </view>

  <!-- 亮点 -->
  <view class="section" wx:if="{{result.highlights.length}}">
    <view class="section-title">✨ 亮点</view>
    <view class="tag-list">
      <view class="tag tag-good" wx:for="{{result.highlights}}" wx:key="*this">{{item}}</view>
    </view>
  </view>

  <!-- 逐句批改 -->
  <view class="section" wx:if="{{result.issues.length}}">
    <view class="section-title">🔧 修改建议 ({{result.issues.length}}处)</view>
    <view class="issue-item" wx:for="{{result.issues}}" wx:key="original">
      <view class="issue-original">
        <text class="issue-label">原文</text>
        <text>{{item.original}}</text>
      </view>
      <view class="issue-suggestion">
        <text class="issue-label">建议</text>
        <text>{{item.suggestion}}</text>
      </view>
      <view class="issue-reason">
        <text class="issue-label">原因</text>
        <text>{{item.reason}}</text>
      </view>
    </view>
  </view>

  <!-- 错别字 -->
  <view class="section" wx:if="{{result.typos && result.typos.length}}">
    <view class="section-title">❌ 错别字</view>
    <view class="typo-row" wx:for="{{result.typos}}" wx:key="wrong">
      <text class="typo-wrong">{{item.wrong}}</text>
      <text class="typo-arrow">→</text>
      <text class="typo-correct">{{item.correct}}</text>
      <text class="typo-pos">（{{item.position}}）</text>
    </view>
  </view>

  <!-- 操作 -->
  <view class="actions">
    <button class="btn-back" bindtap="goBack">再批一篇</button>
    <button class="btn-share" open-type="share">分享给朋友</button>
  </view>
</view>
```

**文件:** `miniapp/pages/result/result.js`
```javascript
Page({
  data: {
    result: {},
    scoreGrade: ''
  },

  onLoad(options) {
    const result = JSON.parse(decodeURIComponent(options.data))
    const grade = result.score >= 90 ? '优秀' : result.score >= 80 ? '良好' : result.score >= 60 ? '及格' : '需努力'
    this.setData({ result, scoreGrade: grade })
  },

  goBack() {
    wx.navigateBack()
  }
})
```

---

## Phase 2: 支付变现

### 核心逻辑
- 免费：每天前 1 次
- 付费：19.9元/月无限次，或 2.9元/次
- 支付用微信支付 JSAPI

### 后端新增端点
- `POST /api/payment/create` — 创建支付订单
- `POST /api/payment/notify` — 微信支付回调
- `GET /api/user/quota` — 查询剩余次数

### 小程序新增
- 支付页面或弹窗
- 历史记录页面（我的批改列表）

---

## Phase 3: 增值功能

- **OCR 拍照识别**：调用百度OCR或微信OCR，手写作文拍照上传
- **范文库**：优秀范文展示
- **分享裂变**：分享后双方各得免费次数
- **多维度评分**：内容/结构/语言/卷面分别打分

---

## 部署清单

| 项目 | 方式 | 费用 |
|------|------|------|
| 后端服务器 | 阿里云/腾讯云轻量 VPS（2核2G） | ~50元/月 |
| 域名 + SSL | 任意域名商 + Let's Encrypt | ~30元/年 |
| DeepSeek API | 按 token 计费 | ~0.01元/篇 |
| 微信小程序 | 认证费 | 300元/年 |
| 微信支付 | 商户号 | 0.6%手续费 |

---

## 关键风险

1. **DeepSeek 返回非标准 JSON** → prompt 严格约束 + 代码容错
2. **微信审核** → 避免教育类敏感词，不承诺"提分"
3. **冷启动获客** → 初期靠朋友圈+家长群传播
