const db = require('../../app/db')
// 提单号批次

module.exports = db.defineModel('tbl_zhongtan_billladingno_batch', {
  billladingno_batch_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billladingno_batch_vessel_service: {
    type: db.STRING(20),
    allowNull: false,
    comment: '服务 VesselServiceINFO'
  },
  billladingno_batch_fix_string: {
    type: db.STRING(20),
    allowNull: false,
    comment: '提单号固定字符'
  },
  billladingno_batch_fix_string_end: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false,
    comment: '提单号固定结尾字符'
  },
  billladingno_batch_number_length: {
    type: db.INTEGER,
    defaultValue: '0',
    allowNull: false,
    comment: '字符长度'
  },
  billladingno_batch_number_start: {
    type: db.INTEGER,
    defaultValue: '0',
    allowNull: false,
    comment: '起始数字'
  },
  billladingno_batch_count: {
    type: db.INTEGER,
    defaultValue: '0',
    allowNull: false,
    comment: '提单数量'
  },
  billladingno_batch_use_count: {
    type: db.INTEGER,
    defaultValue: '0',
    allowNull: false,
    comment: '使用数量'
  }
})
