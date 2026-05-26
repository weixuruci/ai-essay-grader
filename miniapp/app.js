App({
  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: '你的云环境ID', // 开通云开发后在这里填写环境 ID
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
  }
})
