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

  goBack() { wx.navigateBack() },

  onShareAppMessage() {
    const { result, scoreLabel } = this.data
    return {
      title: `AI批改「${result.title || '作业'}」${result.score}分 ${scoreLabel}`,
      path: '/pages/index/index'
    }
  },

  exportImage() {
    const that = this
    wx.showLoading({ title: '生成中...' })

    const query = wx.createSelectorQuery()
    query.select('#exportCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) {
        wx.hideLoading()
        wx.showToast({ title: '生成失败', icon: 'none' })
        return
      }

      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const W = 375
      const dpr = wx.getSystemInfoSync().pixelRatio
      const { result, scoreLabel } = that.data

      canvas.width = W * dpr
      canvas.height = 600 * dpr
      ctx.scale(dpr, dpr)

      // 背景
      ctx.fillStyle = '#F9FAFB'
      ctx.fillRect(0, 0, W, 600)

      // 分数卡片
      ctx.fillStyle = '#4F46E5'
      ctx.fillRect(16, 16, W - 32, 96)

      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 48px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(result.score + '', W / 2, 55)

      ctx.font = '14px sans-serif'
      ctx.fillText('/100', W / 2 + 40, 55)

      ctx.font = 'bold 14px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText(scoreLabel, W / 2, 86)

      // 学科
      ctx.font = '12px sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.textAlign = 'left'
      ctx.fillText((result.subject || '') + ' · ' + (result.grade || ''), 28, 104)

      let y = 128

      // 总评
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(16, y, W - 32, 66)
      ctx.fillStyle = '#1F2937'
      ctx.font = 'bold 14px sans-serif'
      ctx.fillText('总体评价', 28, y + 22)
      ctx.fillStyle = '#6B7280'
      ctx.font = '12px sans-serif'
      wrapText(ctx, result.summary || '', 28, y + 40, W - 56, 18)
      y += 82

      // 亮点
      if (result.highlights && result.highlights.length) {
        const h = 48 + Math.min(result.highlights.length, 3) * 20
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(16, y, W - 32, h)
        ctx.fillStyle = '#1F2937'
        ctx.font = 'bold 14px sans-serif'
        ctx.fillText('亮点', 28, y + 20)
        ctx.fillStyle = '#374151'
        ctx.font = '12px sans-serif'
        result.highlights.slice(0, 3).forEach((hl, i) => {
          ctx.fillText('• ' + hl.slice(0, 30), 28, y + 40 + i * 20)
        })
        y += h + 16
      }

      // 修改建议
      if (result.issues && result.issues.length) {
        const h = 48 + Math.min(result.issues.length, 3) * 20
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(16, y, W - 32, h)
        ctx.fillStyle = '#1F2937'
        ctx.font = 'bold 14px sans-serif'
        ctx.fillText('修改建议', 28, y + 20)
        ctx.fillStyle = '#374151'
        ctx.font = '12px sans-serif'
        result.issues.slice(0, 3).forEach((iss, i) => {
          ctx.fillText((iss.sentence || '').slice(0, 15) + ' → ' + (iss.suggestion || '').slice(0, 15), 28, y + 40 + i * 20)
        })
        y += h + 16
      }

      // 底部
      ctx.fillStyle = '#D1D5DB'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('— AI作业批改 —', W / 2, y + 20)

      // 保存
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas,
          success: (res) => {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                wx.hideLoading()
                wx.showToast({ title: '已保存到相册', icon: 'success' })
              },
              fail: (e) => {
                wx.hideLoading()
                if (e.errMsg.includes('auth deny')) {
                  wx.showToast({ title: '请授权相册权限', icon: 'none' })
                } else {
                  wx.showToast({ title: '保存失败', icon: 'none' })
                }
              }
            })
          },
          fail: () => {
            wx.hideLoading()
            wx.showToast({ title: '生成失败', icon: 'none' })
          }
        })
      }, 500)
    })
  }
})

function wrapText(ctx, text, x, y, maxW, lineH) {
  let line = ''
  let cy = y
  for (const ch of text) {
    const test = line + ch
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy)
      line = ch
      cy += lineH
      if (cy - y > lineH * 4) break
    } else { line = test }
  }
  if (line) ctx.fillText(line, x, cy)
}
