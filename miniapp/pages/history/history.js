const app = getApp()

const SUBJECT_COLORS = {
  '语文': '#EF4444', '数学': '#4F46E5', '英语': '#10B981',
  '物理': '#F59E0B', '化学': '#8B5CF6'
}

Page({
  data: {
    records: [],
    displayRecords: [],
    active: '',
    counts: {},
    viewMode: 'list',
    trendData: [],
    trendMax: 0,
    trendMin: 0,
    trendAvg: 0
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    const records = app.getRecords()
    const counts = { all: records.length }
    records.forEach(r => {
      counts[r.subject] = (counts[r.subject] || 0) + 1
    })
    this.setData({ records, counts })
    this.applyFilter()
    this.updateTrend()
  },

  filter(e) {
    this.setData({ active: e.currentTarget.dataset.subject })
    this.applyFilter()
    this.updateTrend()
  },

  applyFilter() {
    const { active, records } = this.data
    this.setData({
      displayRecords: active
        ? records.filter(r => r.subject === active)
        : records
    })
  },

  switchView(e) {
    const mode = e.currentTarget.dataset.mode
    // 切到趋势视图时，如果没选学科，自动选记录最多的那个
    if (mode === 'trend' && !this.data.active) {
      const { counts } = this.data
      let best = ''
      let max = 0
      for (const k of ['语文','数学','英语','物理','化学']) {
        if (counts[k] > max) { max = counts[k]; best = k }
      }
      if (best) this.setData({ active: best })
    }
    this.setData({ viewMode: mode })
    this.updateTrend()
  },

  updateTrend() {
    const { active, records } = this.data
    // 按学科过滤
    let filtered = active
      ? records.filter(r => r.subject === active)
      : records

    // 取最近 10 条，按时间正序
    filtered = [...filtered].reverse().slice(-10)

    const trendData = filtered.map((r, i) => ({
      score: r.score,
      date: (r.time || '').slice(5, 10), // MM-DD
      subject: r.subject,
      index: i
    }))

    if (trendData.length > 0) {
      const scores = trendData.map(d => d.score)
      this.setData({
        trendData,
        trendMax: Math.max(...scores),
        trendMin: Math.min(...scores),
        trendAvg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      })
    } else {
      this.setData({ trendData: [], trendMax: 0, trendMin: 0, trendAvg: 0 })
    }
  },

  viewDetail(e) {
    const record = e.currentTarget.dataset.record
    wx.navigateTo({
      url: '/pages/result/result?data=' + encodeURIComponent(JSON.stringify(record))
    })
  },

  deleteRecord(e) {
    const record = e.currentTarget.dataset.record
    wx.showModal({
      title: '删除记录',
      content: `确定删除「${record.title}」吗？`,
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          app.deleteRecord(record.id)
          this.loadRecords()
        }
      }
    })
  }
})
