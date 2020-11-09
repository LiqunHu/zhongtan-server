const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_masterbl', {
  export_masterbi_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  export_vessel_id: {
    // 船信息
    type: db.IDNO,
    allowNull: false
  },
  export_masterbi_bl: {
    // 提单号
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_cso_number: {
    // CSO号
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_shipper_company: {
    // 发货人
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_forwarder_company: {
    // 货代
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_consignee_company: {
    // 收货人
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_port_of_load: {
    // 起运港默认TZDAR
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_port_of_discharge: {
    // 卸货港
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_traffic_mode: {
    // 运输方式
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_container_quantity: {
    // 箱总量
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_container_weight: {
    // 箱总重
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_cargo_nature: {
    // 货物属性
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbi_cargo_descriptions: {
    // 货物描述
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  }
})
