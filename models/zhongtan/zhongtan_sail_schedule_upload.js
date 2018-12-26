const db = require('../../app/db')

module.exports = db.defineModel('tbl_zhongtan_sail_schedule_upload', {
  sail_schedule_upload_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  sail_schedule_upload_desc: {
    type: db.STRING(200)
  }
})
