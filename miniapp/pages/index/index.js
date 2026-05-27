const app = getApp()

const TIPS = [
  '正在识别图片内容...',
  'AI老师正在仔细批改中...',
  '卷面工整能提高印象分哦~',
  '错题是进步的阶梯 💪',
  '检查得越仔细，分数越准确',
  '正在分析解题思路...',
  '好的排版让批改更准确',
  '多练习就能看见进步 ✨'
]

Page({
  data: {
    essay: '',
    loading: false,
    images: [],       // [{path, fileID}]
    elapsed: 0,
    currentTip: TIPS[0]
  },

  _timer: null,
  _tipIndex: 0,

  onEssay(e) { this.setData({ essay: e.detail.value }) },

  takePhoto() {
    wx.chooseMedia({
      count: 5 - this.data.images.length,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => this.uploadImages(res.tempFiles)
    })
  },

  pickImage() {
    wx.chooseMedia({
      count: 5 - this.data.images.length,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => this.uploadImages(res.tempFiles)
    })
  },

  async uploadImages(tempFiles) {
    if (tempFiles.length === 0) return
    wx.showLoading({ title: '上传中...' })

    const newImages = []
    for (const f of tempFiles) {
      try {
        const res = await wx.cloud.uploadFile({
          cloudPath: `homework/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
          filePath: f.tempFilePath
        })
        newImages.push({ path: f.tempFilePath, fileID: res.fileID })
      } catch (e) {
        console.error('上传失败', e)
      }
    }

    this.setData({
      images: [...this.data.images, ...newImages].slice(0, 5)
    })
    wx.hideLoading()
  },

  removeImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = this.data.images.filter((_, i) => i !== idx)
    this.setData({ images })
  },

  startLoading() {
    this.setData({ loading: true, elapsed: 0 })
    this._timer = setInterval(() => {
      const e = this.data.elapsed + 1
      this._tipIndex = (this._tipIndex + 1) % TIPS.length
      this.setData({ elapsed: e, currentTip: TIPS[this._tipIndex] })
    }, 1000)
  },

  stopLoading() {
    clearInterval(this._timer)
    this.setData({ loading: false })
  },

  async submit() {
    const { essay, images } = this.data
    if (!images.length && essay.length < 10) {
      wx.showToast({ title: '请拍照或输入至少10字', icon: 'none' })
      return
    }

    this.startLoading()

    try {
      const fileIDs = images.map(img => img.fileID)
      const result = await app.callFunction('grade', {
        fileIDs: fileIDs.length ? fileIDs : undefined,
        essay: essay || undefined
      })

      app.saveRecord({
        title: '作业批改',
        subject: result.subject || '未知',
        grade: result.grade || '未知',
        score: result.score,
        summary: result.summary,
        highlights: result.highlights || [],
        issues: result.issues || [],
        typos: result.typos || []
      })

      app.saveErrors(result.subject, result.issues)

      this.stopLoading()
      this.setData({ essay: '', images: [] })
      wx.navigateTo({
        url: '/pages/result/result?data=' + encodeURIComponent(JSON.stringify(result))
      })
    } catch (err) {
      this.stopLoading()
      wx.showToast({ title: err.message || '批改失败', icon: 'none', duration: 2000 })
    }
  }
})
