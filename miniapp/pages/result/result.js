Page({
  data: {
    result: {},
    scoreLabel: ''
  },

  onLoad(options) {
    const result = JSON.parse(decodeURIComponent(options.data))
    let label = ''
    if (result.score >= 90) label = '优秀'
    else if (result.score >= 80) label = '良好'
    else if (result.score >= 60) label = '及格'
    else label = '需努力'
    this.setData({ result, scoreLabel: label })
  },

  goBack() {
    wx.navigateBack()
  }
})
