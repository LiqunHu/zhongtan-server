const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_icd', {
  icd_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  icd_name: {
    // 堆场名称
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  icd_code: {
    // 堆场代码
    type: db.STRING(20),
    allowNull: false
  },
  icd_email: {
    // 堆场邮箱
    type: db.STRING(1000),
    allowNull: true
  },
  icd_tel: {
    // 堆场电话
    type: db.STRING(300),
    allowNull: true
  },
  icd_edi_type: {
    // edi文件类型
    type: db.STRING(20),
    defaultValue: 'EMAIL',
    allowNull: false
  }
})
