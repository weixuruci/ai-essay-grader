const app = getApp()

Page({
  data: {
    errors: [],
    displayErrors: [],
    active: '',
    counts: {}
  },

  onShow() {
    this.loadErrors()
  },

  loadErrors() {
    const errors = app.getErrors()
    const counts = { all: errors.length }
    errors.forEach(e => {
      counts[e.subject] = (counts[e.subject] || 0) + 1
    })
    this.setData({ errors, counts })
    this.applyFilter()
  },

  filter(e) {
    this.setData({ active: e.currentTarget.dataset.subject })
    this.applyFilter()
  },

  applyFilter() {
    const { active, errors } = this.data
    this.setData({
      displayErrors: active
        ? errors.filter(e => e.subject === active)
        : errors
    })
  },

  deleteError(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '移除错题',
      content: '确定从错题本中移除吗？',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          app.deleteError(id)
          this.loadErrors()
        }
      }
    })
  }
})
