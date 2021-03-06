const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_container', {
  export_container_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  export_vessel_id: {
    // 船信息
    type: db.IDNO,
    allowNull: false
  },
  export_container_bl: {
    // 提单信息
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_container_no: {
    // 箱号
    type: db.STRING(20),
    allowNull: true
  },
  export_container_soc_type: {
    // SOC
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_size_type: {
    // 箱型箱类
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_package: {
    // 包装数
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_package_unit: {
    // 包装类型
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_weight: {
    // 货重
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_weight_unit: {
    // 货重单位
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_volumn: {
    // 体积
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_volumn_unit: {
    // 体积单位
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_edi_loading_date: {
    // 装船船日期
    type: db.STRING(20),
    allowNull: true
  },
  export_container_edi_depot_gate_out_date: {
    // 堆场出场时间
    type: db.STRING(20),
    allowNull: true
  },
  export_container_edi_wharf_gate_in_date: {
    // 码头进场时间
    type: db.STRING(20),
    allowNull: true
  },
  export_container_get_depot_name: {
    // 提箱堆场
    type: db.STRING(20),
    allowNull: true
  }
})
