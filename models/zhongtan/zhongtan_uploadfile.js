const db = require('../../util/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_uploadfile', {
  uploadfile_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  api_name: {
    type: db.STRING(100),
    allowNull: false
  },
  user_id: {
    type: db.ID,
    allowNull: true
  },
  uploadfile_index1: {
    type: db.IDNO,
    allowNull: false
  },
  uploadfile_index2: {
    type: db.IDNO,
    allowNull: true
  },
  uploadfile_index3: {
    type: db.IDNO,
    allowNull: true
  },
  uploadfile_name: {
    type: db.STRING(200),
    defaultValue: '',
    allowNull: true
  },
  uploadfile_url: {
    type: db.STRING(500),
    defaultValue: '',
    allowNull: true
  },
  uploadfile_remark: {
    type: db.STRING(1000),
    defaultValue: '',
    allowNull: true
  }
})
