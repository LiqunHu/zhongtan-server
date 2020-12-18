const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_proforma_masterbl', {
  export_masterbl_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  relation_export_masterbl_id: {
    type: db.IDNO,
    allowNull: true
  },
  export_vessel_id: {
    // 船信息
    type: db.IDNO,
    allowNull: false
  },
  export_masterbl_bl_carrier: {
    // CARRIER
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_bl: {
    // 提单号
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_masterbl_cso_number: {
    // CSO号
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_shipper_company: {
    // 发货人
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_forwarder_company: {
    // 货代
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_consignee_company: {
    // 收货人
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_port_of_load: {
    // 起运港默认TZDAR
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_port_of_discharge: {
    // 卸货港
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_traffic_mode: {
    // 运输方式
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_container_quantity: {
    // 箱总量
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_container_package: {
    // 箱总件数
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_container_weight: {
    // 箱总重
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_container_volumn: {
    // 箱总体积
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_cargo_nature: {
    // 货物属性
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_cargo_descriptions: {
    // 货物描述
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_empty_release_agent: {
    // 放箱代理
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_empty_release_depot: {
    // 放箱堆场
    type: db.STRING(50),
    allowNull: true
  },
  export_masterbl_empty_release_date: {
    // 放箱日期
    type: db.DATE,
    allowNull: true
  },
  export_masterbl_empty_release_valid_to: {
    // 放箱有效期
    type: db.DATEONLY,
    allowNull: true
  },
  export_masterbl_empty_release_approve_date: {
    // 放箱审核日期
    type: db.DATE,
    allowNull: true
  },
  export_masterbl_agent_staff: {
    // agent
    type: db.JSON,
    allowNull: true
  },
  export_masterbl_cargo_type: {
    // 放箱堆场
    type: db.STRING(10),
    defaultValue: 'LOCAL',
    allowNull: false
  }
})
