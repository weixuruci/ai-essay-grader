const app = getApp()

Page({
  data: { records: [] },

  onShow() {
    this.setData({ records: app.getRecords() })
  }
})
