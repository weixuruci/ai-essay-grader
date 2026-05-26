const app = getApp()

Page({
  data: {
    title: '',
    grade: '小学',
    essay: '',
    loading: false
  },

  onTitle(e) { this.setData({ title: e.detail.value }) },
  onEssay(e) { this.setData({ essay: e.detail.value }) },

  pickGrade(e) {
    this.setData({ grade: e.currentTarget.dataset.grade })
  },

  async submit() {
    const { essay, grade, title } = this.data
    if (essay.length < 50) {
      wx.showToast({ title: '作文至少50字', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      const result = await app.callFunction('grade', { essay, grade, title })

      // 保存记录
      app.saveRecord({
        title: title || '未命名',
        grade,
        score: result.score,
        essay: essay.slice(0, 100) + '...',
        summary: result.summary
      })

      // 跳转结果页
      wx.navigateTo({
        url: '/pages/result/result?data=' + encodeURIComponent(JSON.stringify(result))
      })
    } catch (err) {
      wx.showToast({ title: err.message || '批改失败', icon: 'none', duration: 2000 })
    } finally {
      this.setData({ loading: false })
    }
  }
})
