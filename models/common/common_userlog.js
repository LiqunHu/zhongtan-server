const db = require('../../app/db')

module.exports = db.defineModel('tbl_common_userlog', {
  userlog_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: db.UUID,
  },
  api_function: {
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  userlog_method: {
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  userlog_para: {
    type: db.TEXT
  }
})
