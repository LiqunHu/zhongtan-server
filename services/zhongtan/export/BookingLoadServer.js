const moment = require('moment')
const PDFParser = require('pdf2json')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_vessel = model.zhongtan_export_vessel
const tb_bl = model.zhongtan_export_masterbl
const tb_container = model.zhongtan_export_container
const tb_container_size = model.zhongtan_container_size

exports.uploadBookingAct = async req => {
  let doc = common.docValidate(req)
  let sizeConfig = await tb_container_size.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })
  for (let f of doc.upload_files) {
    let pdfData = await pdf2jsonParser(f.response.info.path)
    if(pdfData) {
      if(pdfData.indexOf('OOCL') >= 0) {
        // OOCL
        let regex = ''
        let bookingNumber = '' //提单号，自动加前缀
        let tracfficMode = '' // FCL/FCL
        let shipperCompany = '' // 发货人
        let consigneeCompany = '' // 收货人
        let forwarderCompany = '' // 货代
        let cargoNature = '' // 货物属性
        let cargoDescriptions = '' // 货名
        let etd = '' // 计划开船日期
        let pod = '' // 卸货港
        let ves = '' // 船名
        let voy = '' // 航次
        let quantity = '' // 箱量
        let size = '' // 尺寸
        let type = '' // 箱型
        let weight = '' // 重量
        regex = '/BOOKING\\s*NUMBER\\s*:\\s*([0-9]+)/i'
        bookingNumber = 'OOLU' + common.valueFilter(pdfData, regex)
        regex = '/TRAFFIC\\s*MODE\\s*:\\s*(.+)/i'
        tracfficMode = common.valueFilter(pdfData, regex)
        regex = '/Shipper(.+)Consignee/s'
        let shipperData = common.valueFilter(pdfData, regex)
        regex = '/Company:\\s*(.+)/'
        shipperCompany = common.valueFilter(shipperData, regex)

        regex = '/Consignee(.+)Forwarder/s'
        let consigneeData = common.valueFilter(pdfData, regex)
        regex = '/Company:\\s*(.+)/'
        consigneeCompany = common.valueFilter(consigneeData, regex)

        regex = '/Forwarder(.+)Cargo/s'
        let forwarderData = common.valueFilter(pdfData, regex)
        regex = '/Company:\\s*(.+)/'
        forwarderCompany = common.valueFilter(forwarderData, regex)

        regex = '/Cargo(.+)Routing/s'
        let cargoData = common.valueFilter(pdfData, regex)
        regex = '/Cargo\\s*Nature\\s*:\\s*(.+)/'
        cargoNature = common.valueFilter(cargoData, regex)
        regex = '/Cargo\\s*Descriptions\\s*:\\s*(.+)/'
        cargoDescriptions = common.valueFilter(cargoData, regex)

        let datas = pdfData.replace(/[\r]/ig, '').split(/[\n]+/ig)
        if(datas && datas.length > 0) {
          let rIndex = datas.indexOf('Dar esSalaam')
          if(rIndex >= 0) {
            let cfdStr = datas[rIndex + 1]
            let cfdMoment = moment(common.fileterLNB(cfdStr), 'DD MMMYYYY')
            let etdStr = datas[rIndex + 3]
            let day = etdStr.replace(/[^0-9]/ig, '')
            let month = etdStr.substring(etdStr.indexOf(day) + day.length)
            let etdMoment = moment(day + ' ' + month + ' ' + cfdMoment.year(), 'DD MMM YYYY')
            etd = moment(day + ' ' + month + ' ' + cfdMoment.year(), 'DD MMM YYYY').format('DD/MM/YYYY')
            if(etdMoment.isBefore(cfdMoment)) {
              etd = moment(day + ' ' + month + ' ' + cfdMoment.year() + 1, 'DD MMM YYYY').format('DD/MM/YYYY')
            }
          }
          let vIndex = datas.indexOf('Container Information')
          if(vIndex >= 0) {
            let podStr = datas[vIndex - 2]
            let podReg = /\((Mon)?(Tue)?(Wed)?(Thu)?(Fri)?(Sat)?(Sun)?\)(.+)\((Mon)?(Tue)?(Wed)?(Thu)?(Fri)?(Sat)?(Sun)?\)/
            let podMatchs = podStr.match(podReg)
            if(podMatchs && podMatchs.length > 7) {
              let podMat = podMatchs[8]
              if(podMat) {
                pod = podMat.split(/\d+/)[0]
              }
            }

            let vesStr = datas[vIndex - 4] + ' ' + datas[vIndex - 3]
            vesStr = vesStr.substring(0, vesStr.indexOf('EAX4'))
            let vesStrF = common.fileterLNB(vesStr)
            let vesN = /\d+/.exec(vesStrF)
            if(vesN && vesN.length > 0) {
              ves = vesStr.substring(0, vesStr.indexOf(vesN[0]))
              voy = vesStr.substring(vesStr.indexOf(vesN[0]))
            } else {
              ves = vesStr
            }
            
          }
          let csIndex = datas.indexOf('Container Information')
          let ceIndex = datas.indexOf('Trucking')
          if(csIndex >= 0 && ceIndex >= 0) {
            for (let i = csIndex + 2; i < ceIndex; i++) {
              let conStr = datas[i]
              let conNs = conStr.match(/\d+/g)
              size = conStr.substring(conStr.indexOf('\'') - 2, conStr.indexOf('\''))
              quantity = conStr.substring(0, conStr.indexOf(size + '\''))
              type = conStr.substring(conStr.indexOf('\'') + 1, conStr.indexOf(conNs[1])).trim()
              weight = conNs[1]
            }
          }
        }
        let vessel = await tb_vessel.findOne({
          where: {
            export_vessel_name: ves,
            export_vessel_voyage: voy,
            state: GLBConfig.ENABLE
          }
        })
        if(vessel) {
          if(vessel.export_vessel_code) {
            if(vessel.export_vessel_code.indexOf('OOCL') < 0) {
              vessel.export_vessel_code = 'OOCL' + vessel.export_vessel_code
            }
          } else {
            vessel.export_vessel_code = 'OOCL'
          }
          vessel.save()
        } else {
          vessel = await tb_vessel.create({
            export_vessel_code: 'OOCL',
            export_vessel_name: ves,
            export_vessel_voyage: voy,
            export_vessel_etd: etd
          })
        }
        if(vessel) {
          let ctnrType = ''
          if(sizeConfig) {
            let sizeType = common.fileterLN(size + type).toUpperCase()
            for(let c of sizeConfig) {
              let fullName = c.container_size_full_name
              if(fullName) {
                fullName = common.fileterLN(fullName).toUpperCase()
              }
              if(fullName === sizeType || fullName + 'CONTAINER' === sizeType || fullName === sizeType + 'CONTAINER') {
                ctnrType = c.container_size_code
                break
              }
            }
          }
          let bl = await tb_bl.findOne({
            where: {
              export_vessel_id: vessel.export_vessel_id,
              export_masterbi_bl: bookingNumber,
              state: GLBConfig.ENABLE
            }
          })
          if (bl) {
            bl.export_masterbi_shipper_company = shipperCompany
            bl.export_masterbi_forwarder_company = forwarderCompany
            bl.export_masterbi_consignee_company = consigneeCompany
            bl.export_masterbi_port_of_load = 'TZDAR'
            bl.export_masterbi_port_of_discharge = pod
            bl.export_masterbi_traffic_mode = tracfficMode
            bl.export_masterbi_container_quantity = quantity
            bl.export_masterbi_container_weight = quantity * weight
            bl.export_masterbi_cargo_nature = cargoNature
            bl.export_masterbi_cargo_descriptions = cargoDescriptions
            await bl.save()

            await tb_container.destroy({
              where: {
                export_vessel_id: vessel.export_vessel_id,
                export_container_bl: bookingNumber
              }
            })

            for(let i = 0; i < quantity; i++) {
              await tb_container.create({
                export_vessel_id: vessel.export_vessel_id,
                export_container_bl: bookingNumber,
                export_container_size_type: ctnrType,
                export_container_cargo_weight: weight
              })
            }
          } else {
            await tb_bl.create({
              export_vessel_id: vessel.export_vessel_id,
              export_masterbi_bl: bookingNumber,
              export_masterbi_shipper_company: shipperCompany,
              export_masterbi_forwarder_company: forwarderCompany,
              export_masterbi_consignee_company: consigneeCompany,
              export_masterbi_port_of_load: 'TZDAR',
              export_masterbi_port_of_discharge: pod,
              export_masterbi_traffic_mode: tracfficMode,
              export_masterbi_container_quantity: quantity,
              export_masterbi_container_weight: quantity * weight,
              export_masterbi_cargo_nature: cargoNature,
              export_masterbi_cargo_descriptions: cargoDescriptions,
            })
            for(let i = 0; i < quantity; i++) {
              await tb_container.create({
                export_vessel_id: vessel.export_vessel_id,
                export_container_bl: bookingNumber,
                export_container_soc_type: 'C',
                export_container_size_type: ctnrType,
                export_container_cargo_weight: weight
              })
            }
          }
        }
      } else {
        // COSCO
        let regex = ''
        let bookingNumber = '' //提单号，自动加前缀
        let tracfficMode = '' // FCL/FCL
        let csoNumber = '' // CSO号
        let bookingParty = '' // 
        let forwarder = '' // 
        let shipper = '' // 
        let consignee = '' // 
        let quantity = '' // 
        let size = '' // 
        let type = '' // 
        let pod = ''
        let ves = ''
        let voy = ''
        let etd = ''
        // let finalDestination = ''
        let cargoNature = ''
        let cargoDescription = ''
        let soc = ''
        let cargoWeight = ''
        let datas = pdfData.replace(/[\r]/ig, '').split(/[\n]+/ig)
        regex = '/BOOKING\\s*NUMBER\\s*:\\s*([0-9]+)/i'
        for(let d of datas) {
          bookingNumber = common.valueFilter(d, regex).trim()
          if(bookingNumber) {
            bookingNumber = 'COSU' + bookingNumber
            break
          }
        }
        regex = '/TRAFFIC\\s*MODE\\s*:\\s*(.+)/i'
        for(let d of datas) {
          tracfficMode = common.valueFilter(d, regex).trim()
          if(tracfficMode) {
            break
          }
        }
        regex = '/Agreement\\s*NUMBER\\s*:\\s*([a-zA-Z0-9]+)/i'
        for(let d of datas) {
          csoNumber = common.valueFilter(d, regex).trim()
          if(csoNumber) {
            break
          }
        }
        regex = '/BOOKING\\s*PARTY\\s*:\\s*(.*)/i'
        for(let d of datas) {
          bookingParty = common.valueFilter(d, regex).trim()
          if(bookingParty) {
            break
          }
        }
        regex = '/FORWARDER\\s*:\\s*(.*)/i'
        for(let d of datas) {
          forwarder = common.valueFilter(d, regex).trim()
          if(forwarder) {
            break
          }
        }
        regex = '/SHIPPER\\s*:\\s*(.*)/i'
        for(let d of datas) {
          shipper = common.valueFilter(d, regex).trim()
          if(shipper) {
            break
          }
        }
        regex = '/CONSIGNEE\\s*:\\s*(.*)/i'
        for(let d of datas) {
          consignee = common.valueFilter(d, regex).trim()
          if(consignee) {
            break
          }
        }
        
        let sizeTypeInedx = datas.indexOf('TOTAL BOOKING CONTAINER QTY ')
        if(sizeTypeInedx >= 0) {
          let sizeTypeStr = datas[sizeTypeInedx] + datas[sizeTypeInedx + 1]
          regex = '/TOTAL\\s*BOOKING\\s*CONTAINER\\s*QTY\\s*SIZE\\/TYPE\\s*:\\s*(.*)/i'
          let sizeType = common.valueFilter(sizeTypeStr, regex).trim()
          if(sizeType) {
            quantity = sizeType.substring(0, sizeType.indexOf('X')).trim()
            size = sizeType.substring(sizeType.indexOf('X') + 1, sizeType.indexOf('\'')).trim()
            type = sizeType.substring(sizeType.indexOf('\'') + 1).trim()
          }
        } else {
          regex = '/BOOKING\\s*QTY\\s*SIZE\\/TYPE\\s*:\\s*(.*)/i'
          for(let d of datas) {
            let sizeType = common.valueFilter(d, regex).trim()
            if(sizeType) {
              quantity = sizeType.substring(0, sizeType.indexOf('X')).trim()
              size = sizeType.substring(sizeType.indexOf('X') + 1, sizeType.indexOf('\'')).trim()
              type = sizeType.substring(sizeType.indexOf('\'') + 1).trim()
              break
            }
          }
        }
        regex = '/INTENDED\\s*VESSEL\\/VOYAGE\\s*:\\s*(.*)ETD/i'
        for(let d of datas) {
          let vesVoy = common.valueFilter(d, regex).trim()
          if(vesVoy) {
            ves = vesVoy.substring(0, vesVoy.lastIndexOf(' ')).trim()
            voy = vesVoy.substring(vesVoy.lastIndexOf(' ')).trim()
            break
          }
        }
        regex = '/ETD\\s*:\\s*(.*)/i'
        for(let d of datas) {
          let etdStr = common.valueFilter(d, regex).trim()
          if(etdStr) {
            etd = moment(etdStr, 'DD MMM YYYY').format('DD/MM/YYYY')
            break
          }
        }
        regex = '/FINAL\\s*DESTINATION\\s*:\\s*(.*)/i'
        for(let d of datas) {
          let podStr = common.valueFilter(d, regex).trim()
          if(podStr) {
            pod = podStr.substring(0, podStr.indexOf(','))
            break
          }
        }
        regex = '/CARGO\\s*NATURE\\s*:\\s*(.*)/i'
        for(let d of datas) {
          cargoNature = common.valueFilter(d, regex).trim()
          if(cargoNature) {
            break
          }
        }
        regex = '/CARGO\\s*DESCRIPTION\\s*:\\s*(.*)/i'
        for(let d of datas) {
          cargoDescription = common.valueFilter(d, regex).trim()
          if(cargoDescription) {
            break
          }
        }
        regex = '/SOC\\s*INDICATOR\\s*:\\s*(.*)/i'
        for(let d of datas) {
          soc = common.valueFilter(d, regex).trim()
          if(soc) {
            break
          }
        }
        regex = '/CARGO\\s*WEIGHT\\s*:\\s*([0-9]+)\\s/i'
        for(let d of datas) {
          cargoWeight = common.valueFilter(d, regex).trim()
          if(cargoWeight) {
            break
          }
        }
        let vessel = await tb_vessel.findOne({
          where: {
            export_vessel_name: ves,
            export_vessel_voyage: voy,
            state: GLBConfig.ENABLE
          }
        })
        if(vessel) {
          if(vessel.export_vessel_code) {
            if(vessel.export_vessel_code.indexOf('COSCO') < 0) {
              vessel.export_vessel_code = vessel.export_vessel_code + "+COSCO"
            }
          } else {
            vessel.export_vessel_code = 'COSCO'
          }
          vessel.save()
        } else {
          vessel = await tb_vessel.create({
            export_vessel_code: 'COSCO',
            export_vessel_name: ves,
            export_vessel_voyage: voy,
            export_vessel_etd: etd
          })
        }
        if(vessel) {
          let ctnrType = ''
          if(sizeConfig) {
            let sizeType = common.fileterLN(size + type).toUpperCase()
            for(let c of sizeConfig) {
              let fullName = c.container_size_full_name
              if(fullName) {
                fullName = common.fileterLN(fullName).toUpperCase()
              }
              if(fullName === sizeType || fullName + 'CONTAINER' === sizeType || fullName === sizeType + 'CONTAINER') {
                ctnrType = c.container_size_code
                break
              }
            }
          }
          let bl = await tb_bl.findOne({
            where: {
              export_vessel_id: vessel.export_vessel_id,
              export_masterbi_bl: bookingNumber,
              state: GLBConfig.ENABLE
            }
          })
          if (bl) {
            bl.export_masterbi_cso_number = csoNumber
            bl.export_masterbi_shipper_company = shipper
            bl.export_masterbi_forwarder_company = bookingParty ? bookingParty : forwarder
            bl.export_masterbi_consignee_company = consignee
            bl.export_masterbi_port_of_load = 'TZDAR'
            bl.export_masterbi_port_of_discharge = pod
            bl.export_masterbi_traffic_mode = tracfficMode
            bl.export_masterbi_container_quantity = quantity
            bl.export_masterbi_container_weight = quantity * cargoWeight
            bl.export_masterbi_cargo_nature = cargoNature
            bl.export_masterbi_cargo_descriptions = cargoDescription
            await bl.save()

            await tb_container.destroy({
              where: {
                export_vessel_id: vessel.export_vessel_id,
                export_container_bl: bookingNumber
              }
            })

            for(let i = 0; i < quantity; i++) {
              await tb_container.create({
                export_vessel_id: vessel.export_vessel_id,
                export_container_bl: bookingNumber,
                export_container_soc_type: soc === 'Y' ? 'S' : 'C',
                export_container_size_type: ctnrType,
                export_container_cargo_weight: cargoWeight
              })
            }
          } else {
            await tb_bl.create({
              export_vessel_id: vessel.export_vessel_id,
              export_masterbi_bl: bookingNumber,
              export_masterbi_cso_number: csoNumber,
              export_masterbi_shipper_company: shipper,
              export_masterbi_forwarder_company: bookingParty ? bookingParty : forwarder,
              export_masterbi_consignee_company: consignee,
              export_masterbi_port_of_load: 'TZDAR',
              export_masterbi_port_of_discharge: pod,
              export_masterbi_traffic_mode: tracfficMode,
              export_masterbi_container_quantity: quantity,
              export_masterbi_container_weight: quantity * cargoWeight,
              export_masterbi_cargo_nature: cargoNature,
              export_masterbi_cargo_descriptions: cargoDescription,
            })
            for(let i = 0; i < quantity; i++) {
              await tb_container.create({
                export_vessel_id: vessel.export_vessel_id,
                export_container_bl: bookingNumber,
                export_container_soc_type: soc === 'Y' ? 'S' : 'C',
                export_container_size_type: ctnrType,
                export_container_cargo_weight: cargoWeight
              })
            }
          }
        }
      }
    }
  }
  return common.success()
}

const pdf2jsonParser = async (path) => {
  let parserData = ''
  let promise = new Promise(resolve => {
    let pdfParser = new PDFParser(this, 1)
    pdfParser.loadPDF(path)
    // pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError))
    pdfParser.on('pdfParser_dataReady', () => {
      let data = pdfParser.getRawTextContent()
      resolve(data)
    })
  })
  await promise.then((data) => {
    parserData = data
  })
  return parserData
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}

exports.searchVesselAct = async req => {
  let doc = common.docValidate(req)
  let etd_start_date = doc.etd_start_date
  let etd_end_date = doc.etd_end_date
  let vessel_name = doc.vessel_name
  let masterbi_bl = doc.masterbi_bl
  let queryStr =  `SELECT * FROM tbl_zhongtan_export_vessel v `
  let replacements = []
  if(masterbi_bl) {
    queryStr = queryStr + ` LEFT JOIN tbl_zhongtan_export_masterbl b ON v.export_vessel_id = b.export_vessel_id WHERE v.state = '1' AND b.state = '1' AND b.export_masterbi_bl = ? `
    replacements.push(masterbi_bl)
  } else {
    queryStr = queryStr + ` WHERE v.state = '1' `
  }
  if(etd_start_date && etd_end_date) {
    queryStr = queryStr + ` AND STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") >= ? AND STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") <= ? `
    replacements.push(moment(etd_start_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
    replacements.push(moment(etd_end_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
  }
  if(vessel_name) {
    queryStr = queryStr + ` AND v.export_vessel_name LIKE ? `
    replacements.push('%' + vessel_name + '%')
  }
  queryStr = queryStr + ` ORDER BY v.export_vessel_id `
  let vessels =  await model.simpleSelect(queryStr, replacements)
  if(vessels) {
    for(let v of vessels) {
      let bcount = await tb_bl.count({
        where: {
          export_vessel_id: v.export_vessel_id,
          state: GLBConfig.ENABLE
        }
      })
      let ccount = await tb_container.count({
        where: {
          export_vessel_id: v.export_vessel_id,
          state: GLBConfig.ENABLE
        }
      })
      v.bl_count = bcount
      v.container_count = ccount
    }
  }
  return vessels
}

exports.searchBlAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let export_vessel_id = doc.export_vessel_id
  let masterbi_bl = doc.masterbi_bl
  let queryStr =  `select * from tbl_zhongtan_export_masterbl b WHERE b.export_vessel_id = ? AND b.state = ?`
  let replacements = [export_vessel_id, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND b.export_masterbi_bl = ?`
    replacements.push(masterbi_bl)
  }
  let bls = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = bls.count
  returnData.rows = bls.data
  return returnData
}

exports.searchContainerAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let export_vessel_id = doc.export_vessel_id
  let masterbi_bl = doc.masterbi_bl
  let queryStr =  `select * from tbl_zhongtan_export_container c WHERE c.export_vessel_id = ? AND c.state = ?`
  let replacements = [export_vessel_id, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND c.export_container_bl = ?`
    replacements.push(masterbi_bl)
  }
  let cons = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = cons.count
  returnData.rows = cons.data
  return returnData
}
