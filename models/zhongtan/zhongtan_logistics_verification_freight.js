const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_logistics_verification_freight', {
  logistics_freight_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  logistics_verification_id: {
    type: db.STRING(50),
    allowNull: false
  },
  shipment_list_id: {
    type: db.STRING(50),
    allowNull: false
  },
  logistics_freight_api_name: {
    type: db.STRING(50),
    allowNull: false
  },
  logistics_freight_state: {
    type: db.STRING(50),
    allowNull: false
  },
  logistics_freight_amount: {
    type: db.STRING(20),
    allowNull: false
  }
})
