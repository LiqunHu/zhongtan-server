const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_finance_subject_code', {
  subject_code_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  parent_code: {
    // 父科目编码
    type: db.STRING(20),
    allowNull: false
  },
  subject_code: {
    // 科目编码
    type: db.STRING(20),
    allowNull: false
  },
  subject_code_name: {
    // 科目编码
    type: db.STRING(20),
    allowNull: false
  },
  subject_code_digest: {
    // 摘要
    type: db.STRING(100),
    allowNull: true
  }
})
