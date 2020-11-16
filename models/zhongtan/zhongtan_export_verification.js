const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_verification', {
  export_verification_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  export_masterbl_id: {
    // 提单ID
    type: db.IDNO,
    allowNull: false
  },
  export_verification_api_name: {
    // api
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_verification_bl: {
    // 提单号
    type: db.STRING(50),
    allowNull: false
  },
  export_verification_depot: {
    // 堆场
    type: db.STRING(20),
    allowNull: false
  },
  export_verification_agent: {
    // 代理
    type: db.STRING(50),
    allowNull: false
  },
  export_verification_quantity: {
    // 数量
    type: db.STRING(200),
    allowNull: false
  },
  export_verification_valid_to: {
    // 有效期
    type: db.DATEONLY,
    allowNull: false
  },
  export_verification_state: {
    // 审核状态
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  export_verification_review_date: {
    // 审核时间
    type: db.DATE,
    allowNull: true
  },
  export_verification_review_user: {
    // 审核人
    type: db.STRING(50),
    allowNull: true
  },
  export_verification_create_user: {
    // 申请人
    type: db.STRING(50),
    allowNull: true
  }
})
