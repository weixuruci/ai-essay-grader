App({
  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloudbase-d4gf9jzfdf4ade596', // 开通云开发后在这里填写环境 ID
        traceUser: true
      })
    }
  },

  globalData: {},

  // 统一的云函数调用
  async callFunction(name, data = {}) {
    try {
      const res = await wx.cloud.callFunction({ name, data })
      if (res.result && res.result.error) {
        throw new Error(res.result.error)
      }
      return res.result
    } catch (err) {
      throw new Error(err.message || '请求失败')
    }
  },

  // 保存批改记录到本地
  saveRecord(record) {
    const records = wx.getStorageSync('grade_records') || []
    records.unshift({
      ...record,
      id: Date.now(),
      time: new Date().toLocaleString()
    })
    if (records.length > 50) records.length = 50
    wx.setStorageSync('grade_records', records)
  },

  getRecords() {
    return wx.getStorageSync('grade_records') || []
  },

  deleteRecord(id) {
    const records = wx.getStorageSync('grade_records') || []
    const idx = records.findIndex(r => r.id === id)
    if (idx !== -1) {
      records.splice(idx, 1)
      wx.setStorageSync('grade_records', records)
    }
    return records
  },

  // 错题本
  saveErrors(subject, issues) {
    if (!issues || !issues.length) return
    const errors = wx.getStorageSync('error_book') || []
    const now = new Date().toLocaleString()
    issues.forEach(iss => {
      errors.unshift({
        id: Date.now() + Math.random(),
        subject,
        wrong: iss.sentence || '',
        correct: iss.suggestion || '',
        reason: iss.reason || '',
        time: now
      })
    })
    if (errors.length > 200) errors.length = 200
    wx.setStorageSync('error_book', errors)
  },

  getErrors() {
    return wx.getStorageSync('error_book') || []
  },

  deleteError(id) {
    const errors = wx.getStorageSync('error_book') || []
    const idx = errors.findIndex(e => e.id === id)
    if (idx !== -1) {
      errors.splice(idx, 1)
      wx.setStorageSync('error_book', errors)
    }
  }
})
