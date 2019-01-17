const db = require('../../app/db')
// 提单池

module.exports = db.defineModel('tbl_zhongtan_billladingno_pool', {
  billladingno_pool_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billladingno_pool_no: {
    type: db.STRING(100),
    allowNull: false,
    unique: true,
    comment: '提单号'
  },
  billladingno_batch_id: {
    type: db.IDNO,
    allowNull: false
  },
  billladingno_pool_vessel_service: {
    type: db.STRING(20),
    allowNull: false,
    comment: '服务 VesselServiceINFO'
  },
  billladingno_pool_state: {
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false,
    comment: '状态 LB_BATCH_STATE'
  }
})
