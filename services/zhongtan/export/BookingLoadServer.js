const moment = require('moment')
const PDFParser = require('pdf2json')
const Decimal = require('decimal.js')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const opSrv = require('../../common/system/OperationPasswordServer')
const userSrv = require('../configuration/CustomerServer')

const tb_user = model.common_user
const tb_vessel = model.zhongtan_export_vessel
const tb_bl = model.zhongtan_export_masterbl
const tb_container = model.zhongtan_export_container
const tb_container_size = model.zhongtan_container_size
const tb_verification = model.zhongtan_export_verification
const tb_proforma_vessel = model.zhongtan_export_proforma_vessel
const tb_proforma_bl = model.zhongtan_export_proforma_masterbl
const tb_shipment_fee = model.zhongtan_export_shipment_fee
const tb_uploadfile = model.zhongtan_uploadfile
const tb_export_fee_data = model.zhongtan_export_fee_data
const tb_shipment_fee_log = model.zhongtan_export_shipment_fee_log

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = 1 AND fee_data_code IN ('LOO', 'DND') GROUP BY fee_data_code ORDER BY fee_data_code DESC`
  let replacements = []
  returnData['BK_CANCELLATION_FEE'] = await model.simpleSelect(queryStr, replacements)
  queryStr = `SELECT export_vessel_id, CONCAT(export_vessel_name, '/', export_vessel_voyage) export_vessel_voyage FROM tbl_zhongtan_export_vessel WHERE state = 1 GROUP BY export_vessel_name, export_vessel_voyage ORDER BY export_vessel_name, export_vessel_voyage DESC`
  replacements = []
  returnData['VESSEL_VOYAGES'] = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.uploadBookingAct = async req => {
  let doc = common.docValidate(req)
  let sizeConfig = await tb_container_size.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })
  for (let f of doc.upload_files) {
    await this.importBookingPdf(f.response.info.path, sizeConfig)
  }
  return common.success()
}

exports.importBookingPdf = async (path, sizeConfig) => {
  let pdfData = await pdf2jsonParser(path)
  if(pdfData) {
    if(pdfData.indexOf('OOCL BOOKING ACKNOWLEDGEMENT') >= 0){
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
      let pol = ''
      let pod = ''
      let ves = ''
      let voy = ''
      let etd = ''
      // let finalDestination = ''
      let cargoNature = ''
      let cargoDescription = ''
      // let soc = ''
      let cargoWeight = ''
      let datas = pdfData.replace(/[\r]/ig, '').split(/[\n]+/ig)
      regex = '/BOOKING\\s*NUMBER\\s*:\\s*([0-9]+)/i'
      for(let d of datas) {
        bookingNumber = common.valueFilter(d, regex).trim()
        if(bookingNumber) {
          bookingNumber = 'OOLU' + bookingNumber
          break
        }
      }
      regex = '/CS\\s*Reference\\s*Number\\s*:\\s*([a-zA-Z0-9]+)/i'
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
      regex = '/PORT\\s*OF\\s*LOADING\\s*:\\s*(.*)/i'
      for(let d of datas) {
        let polStr = common.valueFilter(d, regex).trim()
        if(polStr) {
          pol = polStr.substring(0, polStr.indexOf('/')).trim()
          break
        }
      }
      regex = '/INTENDED\\s*VESSEL\\/VOYAGE\\s*:\\s*(.*)ETA/i'
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
      regex = '/PORT\\s*OF\\s*DISCHARGE\\s*:\\s*(.*)/i'
      for(let d of datas) {
        let podStr = common.valueFilter(d, regex).trim()
        if(podStr) {
          pod = podStr.substring(0, podStr.indexOf('/')).trim()
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
      regex = '/CARGO\\s*WEIGHT\\s*\\(MT\\)\\s*:\\s*([0-9]+)/i'
      for(let d of datas) {
        cargoWeight = common.valueFilter(d, regex).trim()
        if(cargoWeight) {
          break
        }
      }
      regex = '/TRAFFIC\\s*MODE\\s*:\\s*(.*)/i'
      for(let d of datas) {
        tracfficMode = common.valueFilter(d, regex).trim()
        if(tracfficMode) {
          break
        }
      }
      let vesJson = {
        vesselName : ves,
        vesselVoyage: voy,
        vesselEtd: etd
      }
      if(quantity) {
        quantity = Number(quantity)
      }
      let blJson = {
        bookingNumber : bookingNumber,
        csoNumber : csoNumber,
        shipperCompany : shipper,
        forwarderCompany : bookingParty ? bookingParty : forwarder,
        consigneeCompany : consignee,
        portOfLoad : pol,
        portOfDischarge : pod,
        tracfficMode : tracfficMode,
        quantity : quantity,
        weight : quantity * cargoWeight,
        cargoNature : cargoNature,
        cargoDescriptions : cargoDescription
      }
      
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
      let conJson = []
      for(let i = 0; i < quantity; i++) {
        conJson.push({
          socType: 'C',
          ctnrType: ctnrType,
          weight: cargoWeight
        })
      }
      await createBooking('OOCL', vesJson, blJson, conJson)
    } else if(pdfData.indexOf('OOCL - Booking') >= 0) {
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
        let pIndex = datas.indexOf('Container Information')
        if(pIndex >= 0) {
          let podStr = datas[pIndex - 2]
          let podReg = /\((Mon)?(Tue)?(Wed)?(Thu)?(Fri)?(Sat)?(Sun)?\)(.+)\((Mon)?(Tue)?(Wed)?(Thu)?(Fri)?(Sat)?(Sun)?\)/
          let podMatchs = podStr.match(podReg)
          if(podMatchs && podMatchs.length > 7) {
            let podMat = podMatchs[8]
            if(podMat) {
              pod = podMat.split(/\d+/)[0]
            }
          }
        }

        let vIndex = datas.findIndex((item) => {
            return item.indexOf('EAX4') >= 0
        })
        if(vIndex >= 0) {
          let vesStr = datas[vIndex]
          if(!/[^a-zA-Z0-9\s]/.exec(datas[vIndex-1])) {
            vesStr = datas[vIndex-1] + ' ' + vesStr
          }
          vesStr = vesStr.substring(0, vesStr.indexOf('EAX4'))
          let vesStrF = common.fileterLNB(vesStr)
          let vesN = /\d+/.exec(vesStrF)
          if(vesN && vesN.length > 0) {
            ves = vesStr.substring(0, vesStr.indexOf(vesN[0])).trim()
            voy = vesStr.substring(vesStr.indexOf(vesN[0])).trim()
          } else {
            ves = vesStr
          }
        }

        let csIndex = datas.indexOf('Container Information')
        let ceIndex = datas.indexOf('Trucking')
        if(csIndex >= 0 && ceIndex >= 0) {
          for (let i = csIndex + 2; i < ceIndex; i++) {
            let conStr = datas[i]
            if(conStr && conStr.indexOf('Kilograms') >= 0) {
              let conNs = conStr.match(/\d+/g)
              size = conStr.substring(conStr.indexOf('\'') - 2, conStr.indexOf('\''))
              quantity = conStr.substring(0, conStr.indexOf(size + '\''))
              type = conStr.substring(conStr.indexOf('\'') + 1, conStr.indexOf(conNs[1])).trim()
              weight = conNs[1]
            }
          }
        }
      }
      let vesJson = {
        vesselName : ves,
        vesselVoyage: voy,
        vesselEtd: etd
      }
      if(quantity) {
        quantity = Number(quantity)
      }
      let blJson = {
        bookingNumber : bookingNumber,
        csoNumber : '',
        shipperCompany : shipperCompany,
        forwarderCompany : forwarderCompany,
        consigneeCompany : consigneeCompany,
        portOfLoad : 'TZDAR',
        portOfDischarge : pod,
        tracfficMode : tracfficMode,
        quantity : quantity,
        weight : quantity * weight,
        cargoNature : cargoNature,
        cargoDescriptions : cargoDescriptions
      }
      
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
      let conJson = []
      for(let i = 0; i < quantity; i++) {
        conJson.push({
          socType: 'C',
          ctnrType: ctnrType,
          weight: weight
        })
      }
      await createBooking('OOCL', vesJson, blJson, conJson)
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

      let blCons = []
      let conIndexs = []
      for(let i = 0; i < datas.length; i++) {
        let idx = datas[i].indexOf('BOOKING QTY SIZE/TYPE:')
        if(idx >= 0) {
          conIndexs.push(i)
        } 
      }
      if(conIndexs && conIndexs.length > 0) {
        let conStr = []
        if(conIndexs.length === 1) {
          let item = datas.slice(conIndexs[0] > 0 ? conIndexs[0] -1 : conIndexs[0])
          conStr.push(item)
        } else {
          for(let ii = 0; ii < conIndexs.length - 1; ii++) {
            let next = ii + 1
            let item = datas.slice(ii === 0 && conIndexs[ii] > 0 ? conIndexs[ii] -1 : conIndexs[ii], conIndexs[next])
            conStr.push(item)
            if(next >= conIndexs.length - 1) {
              let lastItem = datas.slice(conIndexs[next])
              conStr.push(lastItem)
            }
          }
        }

        if(conStr && conStr.length > 0) {
          for(let cs of conStr) {
            if(cs) {
              for(let c of cs) {
                regex = '/BOOKING\\s*QTY\\s*SIZE\\/TYPE\\s*:\\s*(.*)/i'
                let sizeType = common.valueFilter(c, regex).trim()
                if(sizeType) {
                  quantity = sizeType.substring(0, sizeType.indexOf('X')).trim()
                  size = sizeType.substring(sizeType.indexOf('X') + 1, sizeType.indexOf('\'')).trim()
                  type = sizeType.substring(sizeType.indexOf('\'') + 1).trim()
                  break
                }
              }
              for(let c of cs) {
                regex = '/SOC\\s*INDICATOR\\s*:\\s*(.*)/i'
                soc = common.valueFilter(c, regex).trim()
                if(soc) {
                  break
                }
              }
              for(let c of cs) {
                regex = '/CARGO\\s*WEIGHT\\s*:\\s*([0-9]+)\\s/i'
                cargoWeight = common.valueFilter(c, regex).trim()
                if(cargoWeight) {
                  break
                }
              }
            }

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
            if(quantity) {
              quantity = Number(quantity)
            }
            blCons.push({
              ctnrType: ctnrType,
              quantity: quantity,
              soc: soc,
              cargoWeight: cargoWeight
            })
          }
        }
      } else {
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
        if(quantity) {
          quantity = Number(quantity)
        }
        blCons.push({
          ctnrType: ctnrType,
          quantity: quantity,
          soc: soc,
          cargoWeight: cargoWeight
        })
      }
      
      let vesJson = {
        vesselName : ves,
        vesselVoyage: voy,
        vesselEtd: etd
      }
      let blQuantity = 0
      let blWeight = 0
      for(let bc of blCons) {
        blQuantity = blQuantity + bc.quantity
        blWeight = blWeight + bc.quantity * bc.cargoWeight
      }
      let blJson = {
        bookingNumber : bookingNumber,
        csoNumber : csoNumber,
        shipperCompany : shipper,
        forwarderCompany : bookingParty ? bookingParty : forwarder,
        consigneeCompany : consignee,
        portOfLoad : 'TZDAR',
        portOfDischarge : pod,
        tracfficMode : tracfficMode,
        quantity : blQuantity,
        weight : blWeight,
        cargoNature : cargoNature,
        cargoDescriptions : cargoDescription
      }
      let conJson = []
      for(let bc of blCons) {
        for(let i = 0; i < bc.quantity; i++) {
          conJson.push({
            socType: bc.soc === 'Y' ? 'S' : 'C',
            ctnrType: bc.ctnrType,
            weight: bc.cargoWeight
          })
        }
      }
      await createBooking('COSCO', vesJson, blJson, conJson)
    }
  }
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

const createBooking = async (carrier, ves, bl, cons) => {
  let vessel = await tb_vessel.findOne({
    where: {
      export_vessel_name: ves.vesselName,
      export_vessel_voyage: ves.vesselVoyage,
      state: GLBConfig.ENABLE
    }
  })
  if(vessel) {
    if(vessel.export_vessel_code) {
      if(vessel.export_vessel_code.indexOf(carrier) < 0) {
        vessel.export_vessel_code = carrier + vessel.export_vessel_code
      }
    } else {
      vessel.export_vessel_code = carrier
    }
    vessel.export_vessel_etd = ves.vesselEtd
    vessel.save()
  } else {
    vessel = await tb_vessel.create({
      export_vessel_code: carrier,
      export_vessel_name: ves.vesselName,
      export_vessel_voyage: ves.vesselVoyage,
      export_vessel_etd: ves.vesselEtd
    })
  }
  // 只查提单号
  let eb = await tb_bl.findOne({
    where: {
      export_masterbl_bl: bl.bookingNumber,
      state: GLBConfig.ENABLE
    }
  })
  if(eb) {
    let queryStr = `SELECT * FROM tbl_zhongtan_export_masterbl WHERE state = '1' AND export_masterbl_bl LIKE ? AND export_masterbl_id <> ? ORDER BY export_masterbl_id DESC LIMIT 1`
    let replacements = ['%' + eb.export_masterbl_bl, eb.export_masterbl_id]
    let oldBls = await model.simpleSelect(queryStr, replacements)
    if(oldBls && oldBls.length > 0) {
      let count = oldBls[0].export_masterbl_bl.match(/\*/g)
      if(count && count.length > 0) {
        eb.export_masterbl_bl = Array(count.length + 2).join('*') + eb.export_masterbl_bl
      } else {
        eb.export_masterbl_bl = '*' + eb.export_masterbl_bl
      }
    } else {
      eb.export_masterbl_bl = '*' + eb.export_masterbl_bl
    }
    await eb.save()
    queryStr = `SELECT * FROM tbl_zhongtan_export_container WHERE state = '1' AND export_vessel_id = ? AND export_container_bl = ? `
    replacements = [eb.export_vessel_id, bl.bookingNumber]
    let oldCons = await model.simpleSelect(queryStr, replacements)
    let copyCons = []
    if(oldCons && oldCons.length > 0) {
      for(let c of oldCons) {
        let oc = await tb_container.findOne({
          where: {
            export_container_id: c.export_container_id
          }
        })
        if(oc) {
          if(oc.export_container_no
            || oc.export_container_edi_loading_date
            || oc.export_container_edi_depot_gate_out_date
            || oc.export_container_edi_wharf_gate_in_date
            || oc.export_container_get_depot_name) {
              let copyCon = JSON.parse(JSON.stringify(oc))
              delete copyCon.export_container_id
              delete copyCon.export_vessel_id
              delete copyCon.export_container_bl
              delete copyCon.export_container_soc_type
              delete copyCon.export_container_size_type
              delete copyCon.export_container_cargo_weight
              copyCons.push(copyCon)
          }
          oc.export_container_bl = eb.export_masterbl_bl
          await oc.save()
        }
      }
    }
    let copyeb = JSON.parse(JSON.stringify(eb))
    delete copyeb.export_masterbl_id
    delete copyeb.export_vessel_id
    delete copyeb.export_masterbl_bl_carrier
    delete copyeb.export_masterbl_bl
    delete copyeb.export_masterbl_cso_number
    delete copyeb.export_masterbl_shipper_company
    if(!copyeb.export_masterbl_forwarder_company_input) {
      delete copyeb.export_masterbl_forwarder_company
    }
    delete copyeb.export_masterbl_consignee_company
    delete copyeb.export_masterbl_port_of_load
    delete copyeb.export_masterbl_port_of_discharge
    if(!copyeb.export_masterbl_traffic_mode_input) {
      delete copyeb.export_masterbl_traffic_mode
    }
    delete copyeb.export_masterbl_container_quantity
    delete copyeb.export_masterbl_container_weight
    delete copyeb.export_masterbl_cargo_nature
    delete copyeb.export_masterbl_cargo_descriptions
    let newBl = {
      export_vessel_id: vessel.export_vessel_id,
      export_masterbl_bl_carrier: carrier,
      export_masterbl_bl: bl.bookingNumber,
      export_masterbl_cso_number: bl.csoNumber ? bl.csoNumber : '',
      export_masterbl_shipper_company: bl.shipperCompany,
      export_masterbl_forwarder_company: bl.forwarderCompany,
      export_masterbl_consignee_company: bl.consigneeCompany,
      export_masterbl_port_of_load: bl.portOfLoad,
      export_masterbl_port_of_discharge: bl.portOfDischarge,
      export_masterbl_traffic_mode: bl.tracfficMode,
      export_masterbl_container_quantity: bl.quantity,
      export_masterbl_container_weight: bl.weight,
      export_masterbl_cargo_nature: bl.cargoNature,
      export_masterbl_cargo_descriptions: bl.cargoDescriptions,
    }
    await tb_bl.create(Object.assign(newBl, copyeb))
    if(copyCons && copyCons.length > 0) {
      for(let i = 0; i < cons.length; i++) {
        let newCon = {
          export_vessel_id: vessel.export_vessel_id,
          export_container_bl: bl.bookingNumber,
          export_container_soc_type: cons[i].socType,
          export_container_size_type: cons[i].ctnrType,
          export_container_cargo_weight: cons[i].weight
        }
        if(copyCons.length > i) {
          await tb_container.create(Object.assign(newCon, copyCons[i]))
        } else {
          await tb_container.create(newCon)
        }
      }
    } else {
      for(let i = 0; i < cons.length; i++) {
        await tb_container.create({
          export_vessel_id: vessel.export_vessel_id,
          export_container_bl: bl.bookingNumber,
          export_container_soc_type: cons[i].socType,
          export_container_size_type: cons[i].ctnrType,
          export_container_cargo_weight: cons[i].weight
        })
      }
    }
  } else {
    await tb_bl.create({
      export_vessel_id: vessel.export_vessel_id,
      export_masterbl_bl_carrier: carrier,
      export_masterbl_bl: bl.bookingNumber,
      export_masterbl_cso_number: bl.csoNumber ? bl.csoNumber : '',
      export_masterbl_shipper_company: bl.shipperCompany,
      export_masterbl_forwarder_company: bl.forwarderCompany,
      export_masterbl_consignee_company: bl.consigneeCompany,
      export_masterbl_port_of_load: bl.portOfLoad,
      export_masterbl_port_of_discharge: bl.portOfDischarge,
      export_masterbl_traffic_mode: bl.tracfficMode,
      export_masterbl_container_quantity: bl.quantity,
      export_masterbl_container_weight: bl.weight,
      export_masterbl_cargo_nature: bl.cargoNature,
      export_masterbl_cargo_descriptions: bl.cargoDescriptions,
    })
    for(let i = 0; i < cons.length; i++) {
      await tb_container.create({
        export_vessel_id: vessel.export_vessel_id,
        export_container_bl: bl.bookingNumber,
        export_container_soc_type: cons[i].socType,
        export_container_size_type: cons[i].ctnrType,
        export_container_cargo_weight: cons[i].weight
      })
    }
  }
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}

exports.searchVesselAct = async req => {
  let doc = common.docValidate(req)
  let etd_start_date = doc.etd_start_date
  let etd_end_date = doc.etd_end_date
  let vessel_id = doc.vessel_id
  let masterbi_bl = doc.masterbi_bl
  let firm_booking = doc.firm_booking
  let forwarder = doc.forwarder
  let shipper = doc.shipper
  let consignee = doc.consignee
  let queryStr =  `SELECT * FROM tbl_zhongtan_export_vessel v WHERE v.state = '1'`
  let replacements = []
  if(masterbi_bl) {
    queryStr = queryStr + ` AND v.export_vessel_id IN (SELECT export_vessel_id from tbl_zhongtan_export_masterbl WHERE state = '1' AND export_masterbl_bl like ? )`
    replacements.push('%' + masterbi_bl + '%')
  } 

  if(firm_booking) {
    queryStr = queryStr + ` AND v.export_vessel_id IN (SELECT export_vessel_id from tbl_zhongtan_export_masterbl WHERE state = '1' AND export_masterbl_firm_booking = ? )`
    replacements.push(firm_booking)
  }
  if(forwarder) {
    queryStr = queryStr + ` AND v.export_vessel_id IN (SELECT export_vessel_id from tbl_zhongtan_export_masterbl WHERE state = '1' AND export_masterbl_forwarder_company = ? )`
    replacements.push(forwarder)
  }
  if(shipper) {
    queryStr = queryStr + ` AND v.export_vessel_id IN (SELECT export_vessel_id from tbl_zhongtan_export_masterbl WHERE state = '1' AND export_masterbl_shipper_company LIKE ? )`
    replacements.push('%' + shipper + '%')
  }
  if(consignee) {
    queryStr = queryStr + ` AND v.export_vessel_id IN (SELECT export_vessel_id from tbl_zhongtan_export_masterbl WHERE state = '1' AND export_masterbl_consignee_company LIKE ? )`
    replacements.push('%' + consignee + '%')
  }
  if(etd_start_date && etd_end_date) {
    queryStr = queryStr + ` AND STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") >= ? AND STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") <= ? `
    replacements.push(moment(etd_start_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
    replacements.push(moment(etd_end_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
  }
  if(vessel_id) {
    queryStr = queryStr + ` AND v.export_vessel_id = ? `
    replacements.push(vessel_id)
  }
  queryStr = queryStr + ` ORDER BY STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") DESC `
  let vessels =  await model.simpleSelect(queryStr, replacements)
  if(vessels) {
    for(let v of vessels) {
      v.size_types = []
      let bcountStr = `SELECT COUNT(1) AS count FROM tbl_zhongtan_export_masterbl WHERE export_vessel_id = ? AND state = ? AND INSTR(export_masterbl_bl, '*') = 0`
      let bcountReplacements = [v.export_vessel_id, GLBConfig.ENABLE]
      let bcount = await model.simpleSelect(bcountStr, bcountReplacements)
      let ccountStr = `SELECT COUNT(1) AS count FROM tbl_zhongtan_export_container WHERE export_vessel_id = ? AND state = ? AND INSTR(export_container_bl, '*') = 0`
      let ccountReplacements = [v.export_vessel_id, GLBConfig.ENABLE]
      let ccount = await model.simpleSelect(ccountStr, ccountReplacements)
      let gweightStr = `SELECT SUM(export_container_cargo_weight) AS weight, (COUNT(IF(SUBSTR(export_container_size_type, 1, 1) = '2', TRUE, NULL)) * 2200 + COUNT(IF(SUBSTR(export_container_size_type, 1, 1) != '2', TRUE, NULL)) * 4400) tareWeight FROM tbl_zhongtan_export_container WHERE export_vessel_id = ? AND state = ? AND INSTR(export_container_bl, '*') = 0`
      let gweightReplacements = [v.export_vessel_id, GLBConfig.ENABLE]
      let gweight = await model.simpleSelect(gweightStr, gweightReplacements)
      v.bl_count = bcount[0].count
      v.container_count = ccount[0].count
      v.gross_weight = gweight[0].weight
      v.tare_weight = gweight[0].tareWeight
      queryStr = `SELECT export_container_size_type containers_size, COUNT(1) containers_size_count FROM tbl_zhongtan_export_container WHERE state = '1' AND export_vessel_id = ? AND INSTR(export_container_bl, '*') = 0 GROUP BY export_container_size_type`
      replacements = [v.export_vessel_id]
      let sts = await model.simpleSelect(queryStr, replacements)
      if(sts && sts.length > 0) {
        v.size_types = JSON.parse(JSON.stringify(sts))
      }
    }
  }
  return vessels
}

exports.searchBlAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let export_vessel_id = doc.export_vessel_id
  let masterbi_bl = doc.masterbi_bl
  let firm_booking = doc.firm_booking
  let forwarder = doc.forwarder
  let shipper = doc.shipper
  let consignee = doc.consignee
  let queryStr =  `select * from tbl_zhongtan_export_masterbl b WHERE b.export_vessel_id = ? AND b.state = ?`
  let replacements = [export_vessel_id, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND b.export_masterbl_bl LIKE ?`
    replacements.push('%' + masterbi_bl + '%')
  }
  if(firm_booking) {
    queryStr = queryStr + ` AND b.export_masterbl_firm_booking = ?`
    replacements.push(firm_booking)
  }
  if(forwarder) {
    queryStr = queryStr + ` AND b.export_masterbl_forwarder_company = ?`
    replacements.push(forwarder)
  }
  if(shipper) {
    queryStr = queryStr + ` AND b.export_masterbl_shipper_company LIKE ?`
    replacements.push('%' + shipper + '%')
  }
  if(consignee) {
    queryStr = queryStr + ` AND b.export_masterbl_consignee_company LIKE ?`
    replacements.push('%' + consignee + '%')
  }
  let bls = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = bls.count
  returnData.rows = []
  if(bls.data) {
    for(let d of bls.data) {
      let cancellationFees = []
      let pro_bl = await tb_proforma_bl.findOne({
        where: {
          state: GLBConfig.ENABLE,
          relation_export_masterbl_id: d.export_masterbl_id
        }
      })
      if(!pro_bl) {
        let ves = await tb_vessel.findOne({
          where: {
            export_vessel_id: d.export_vessel_id,
            state: GLBConfig.ENABLE
          }
        })
        if(ves) {
          let pro_ves = await tb_proforma_vessel.findOne({
            where: {
              export_vessel_name: ves.export_vessel_name.trim(),
              export_vessel_voyage: ves.export_vessel_voyage.trim(),
              state: GLBConfig.ENABLE
            }
          })
          if(pro_ves) {
            pro_bl = await tb_proforma_bl.findOne({
              where: {
                export_vessel_id: pro_ves.export_vessel_id,
                export_masterbl_bl: d.export_masterbl_bl,
                state: GLBConfig.ENABLE
              }
            })
          }
        }
      }
      if(pro_bl && pro_bl.bk_cancellation_status !== GLBConfig.ENABLE) {
        d.bk_cancellation = GLBConfig.DISABLE
      } else {
        d.bk_cancellation = GLBConfig.ENABLE
        d.bk_cancellation_disabled = false
        if(pro_bl && pro_bl.bk_cancellation_status === GLBConfig.ENABLE) {
          let fees = await tb_shipment_fee.findAll({
            where: {
              export_masterbl_id: pro_bl.export_masterbl_id,
              state: GLBConfig.ENABLE
            }
          })
          if(fees) {
            for (let f of fees) {
              cancellationFees.push({
                fee_data_code: f.fee_data_code,
                fee_data_amount: f.shipment_fee_amount
              })
              if(f.shipment_fee_receipt_no) {
                d.bk_cancellation_disabled = true
              }
              d.bk_cancellation_input = true
            }
          }
        }
      }
      d.cancellationFee = cancellationFees
      d.attachments = await tb_uploadfile.findAll({
        where: {
          api_name: 'EMPTY RELEASE',
          uploadfile_index1: d.export_masterbl_id,
          state: GLBConfig.ENABLE
        }
      })
      returnData.rows.push(d)
    }
  }
  return returnData
}

exports.searchContainerAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let export_vessel_id = doc.export_vessel_id
  let masterbi_bl = doc.masterbi_bl
  let firm_booking = doc.firm_booking
  let forwarder = doc.forwarder
  let consignee = doc.consignee
  let queryStr =  `select * from tbl_zhongtan_export_container c WHERE c.export_vessel_id = ? AND c.state = ?`
  let replacements = [export_vessel_id, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND c.export_container_bl LIKE ?`
    replacements.push('%' + masterbi_bl + '%')
  }
  if(firm_booking) {
    queryStr = queryStr + ` AND c.export_container_bl IN (SELECT export_masterbl_bl FROM tbl_zhongtan_export_masterbl WHERE state = 1 AND export_vessel_id = ? AND export_masterbl_firm_booking = ?)`
    replacements.push(export_vessel_id, firm_booking)
  }

  if(forwarder) {
    queryStr = queryStr + ` AND c.export_container_bl IN (SELECT export_masterbl_bl from tbl_zhongtan_export_masterbl WHERE state = '1' AND export_masterbl_forwarder_company = ? )`
    replacements.push(forwarder)
  }

  if(consignee) {
    queryStr = queryStr + ` AND c.export_container_bl IN (SELECT export_masterbl_bl from tbl_zhongtan_export_masterbl WHERE state = '1' AND export_masterbl_consignee_company LIKE ? )`
    replacements.push('%' + consignee + '%')
  }
  let cons = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = cons.count
  returnData.rows = cons.data
  return returnData
}

exports.modifyVesselAct = async req => {
  let doc = common.docValidate(req)
  let vessel = await tb_vessel.findOne({
    where: {
      export_vessel_id: doc.export_vessel_id
    }
  })
  if(vessel) {
    vessel.export_vessel_name = doc.export_vessel_name
    vessel.export_vessel_voyage = doc.export_vessel_voyage
    vessel.export_vessel_etd = doc.export_vessel_etd
    await vessel.save()
  }
  return common.success()
}

exports.deleteVesselAct = async req => {
  let doc = common.docValidate(req)
  let vessel = await tb_vessel.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_vessel_id: doc.export_vessel_id
    }
  })
  if(vessel) {
    vessel.state = GLBConfig.DISABLE
    await vessel.save()
    let bls = await tb_bl.findAll({
      where: {
        state: GLBConfig.ENABLE,
        export_vessel_id: doc.export_vessel_id
      }
    })
    for(let b of bls) {
      b.state = GLBConfig.DISABLE
      await b.save()
    }
    let cons = await tb_container.findAll({
      where: {
        state: GLBConfig.ENABLE,
        export_vessel_id: doc.export_vessel_id
      }
    })
    for(let c of cons) {
      c.state = GLBConfig.DISABLE
      await c.save()
    }
  }
  return common.success()
}

exports.checkPasswordAct = async req => {
  let doc = common.docValidate(req)
  let check = await opSrv.checkPassword(doc.action, doc.checkPassword)
  if(check) {
    return common.success()
  } else {
    return common.error('auth_24')
  }
}

exports.getEmptyReleaseDataAct = async req => {
  let doc = common.docValidate(req)
  let retData = {}
  let bl = await tb_bl.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    let queryStr = ''
    let replacements = []
    retData.masterbl_bl = JSON.parse(JSON.stringify(bl))
    queryStr = `SELECT COUNT(1) AS quantity, COUNT(1) AS release_quantity, s.container_size_name AS container_type FROM tbl_zhongtan_export_container c 
                      LEFT JOIN tbl_zhongtan_container_size s ON (c.export_container_size_type = s.container_size_code OR c.export_container_size_type = s.container_size_name) AND s.container_size_name != '40RQ'
                      WHERE c.export_vessel_id = ? AND c.export_container_bl = ? AND c.state = '1' GROUP BY s.container_size_name`
    replacements = [bl.export_vessel_id, bl.export_masterbl_bl]
    retData.quantitys = await model.simpleSelect(queryStr, replacements)
    if(!retData.masterbl_bl.export_masterbl_empty_release_valid_to) {
      retData.masterbl_bl.export_masterbl_empty_release_valid_to = moment().add(7, 'days').format('YYYY-MM-DD')
    }
    let agents = []
    if(!retData.masterbl_bl.export_masterbl_empty_release_agent && retData.masterbl_bl.export_masterbl_forwarder_company) {
      queryStr = `select a.user_id, a.user_name, a.user_blacklist, a.user_customer_type from tbl_common_user a where a.state = '1' and a.user_type = '${GLBConfig.TYPE_CUSTOMER}' and a.user_name = ? ORDER BY user_id DESC LIMIT 1`
      replacements = [retData.masterbl_bl.export_masterbl_forwarder_company]
      agents = await model.simpleSelect(queryStr, replacements)
      if (agents && agents.length > 0) {
        retData.masterbl_bl.export_masterbl_empty_release_agent = agents[0].user_id
      }
    } else if(retData.masterbl_bl.export_masterbl_empty_release_agent) {
      queryStr = `select a.user_id, a.user_name, a.user_blacklist, a.user_customer_type from tbl_common_user a where a.state = '1' and a.user_type = '${GLBConfig.TYPE_CUSTOMER}' and a.user_id = ? `
      replacements = [retData.masterbl_bl.export_masterbl_empty_release_agent]
      agents = await model.simpleSelect(queryStr, replacements)
    }
    retData.agents = agents
    retData.depots = []
    queryStr = `SELECT edi_depot_id, edi_depot_name FROM tbl_zhongtan_edi_depot WHERE state = ? ORDER BY edi_depot_name`
    replacements = [GLBConfig.ENABLE]
    let depots = await model.simpleSelect(queryStr, replacements)
    if(depots && depots.length > 0) {
      retData.depots = depots
    }
    let agent_staff = []
    if(bl.export_masterbl_agent_staff) {
      if(bl.export_masterbl_agent_staff.length > 1) {
        agent_staff = bl.export_masterbl_agent_staff.slice(0, 2)
      } else {
        agent_staff = bl.export_masterbl_agent_staff
        agent_staff.push({staff_name: '', staff_id: ''})
      }
    } else {
      agent_staff = [{staff_name: '', staff_id: ''}, {staff_name: '', staff_id: ''}]
    }
    retData.agent_staff = agent_staff
  }
  return common.success(retData)
}

exports.getEmptyReleaseAgentsAct = async req => {
  let doc = common.docValidate(req)
  let retData = {}
  if(doc.query) {
    let queryStr = `select a.user_id, a.user_name, a.user_blacklist, a.user_customer_type from tbl_common_user a where a.state = '1' and a.user_type = '${GLBConfig.TYPE_CUSTOMER}' and a.user_name LIKE ? ORDER BY user_name LIMIT 10`
    let replacements = ['%' + doc.query + '%']
    let agents = await model.simpleSelect(queryStr, replacements)
    retData.agents = JSON.parse(JSON.stringify(agents))
  }
  return common.success(retData)
}

exports.emptyReleaseAct = async req => {
  let doc = common.docValidate(req), user = req.user
  if(userSrv.changeBlacklistAct(doc.export_masterbl_empty_release_agent)) {
    return common.error('export_03')
  }
  let bl = await tb_bl.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    let unRelease = await tb_verification.findAll({
      where: {
        state: GLBConfig.ENABLE,
        export_masterbl_id: bl.export_masterbl_id,
        export_verification_state: 'PM'
      }
    })
    if(unRelease) {
      for(let r of unRelease) {
        r.state = GLBConfig.DISABLE
        await r.save()
      }
    }
    let quantity = ''
    for(let q of doc.quantitys) {
      quantity = quantity + q.release_quantity + 'x' + q.container_type + ';'
    }
    quantity = quantity.substring(0, quantity.length - 1)
    await tb_verification.create({
      export_masterbl_id: bl.export_masterbl_id,
      export_verification_api_name: 'EMPTY RELEASE',
      export_verification_bl: bl.export_masterbl_bl,
      export_verification_depot: doc.export_masterbl_empty_release_depot,
      export_verification_agent: doc.export_masterbl_empty_release_agent,
      export_verification_quantity: quantity,
      export_verification_valid_to: doc.export_masterbl_empty_release_valid_to,
      export_verification_state: 'PM',
      export_verification_create_user: user.user_id
    })
    bl.export_masterbl_empty_release_agent = doc.export_masterbl_empty_release_agent
    bl.export_masterbl_empty_release_depot = doc.export_masterbl_empty_release_depot
    bl.export_masterbl_empty_release_date = moment()
    bl.export_masterbl_empty_release_valid_to = doc.export_masterbl_empty_release_valid_to
    bl.export_masterbl_agent_staff = doc.agentStaff

    if(doc.export_masterbl_empty_release_guarantee_letter_list) {
      for(let letter of doc.export_masterbl_empty_release_guarantee_letter_list) {
        let fileInfo = await common.fileSaveMongo(letter.response.info.path, 'zhongtan')
        await tb_uploadfile.create({
          api_name: 'EMPTY RELEASE',
          user_id: user.user_id,
          uploadfile_index1: bl.export_masterbl_id,
          uploadfile_name: fileInfo.name,
          uploadfile_url: fileInfo.url,
          uploadfile_state: 'PM'
        })
      }
    }
    await bl.save()
  }
  return common.success()
}

exports.bookingDataSaveAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_bl.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    if(doc.export_masterbl_empty_release_agent) {
      bl.export_masterbl_empty_release_agent = doc.export_masterbl_empty_release_agent
      let user = await tb_user.findOne({
        where: {
          user_id: bl.export_masterbl_empty_release_agent
        }
      })
      if(user && bl.export_masterbl_forwarder_company !== user.user_name) {
        bl.export_masterbl_forwarder_company = user.user_name
        bl.export_masterbl_forwarder_company_input = user.user_name
      }
    }
    if(doc.export_masterbl_cargo_type && doc.export_masterbl_cargo_type !== bl.export_masterbl_cargo_type) {
      bl.export_masterbl_cargo_type = doc.export_masterbl_cargo_type
      bl.export_masterbl_cargo_type_input = doc.export_masterbl_cargo_type
    }
    await bl.save()
  }
  return common.success()
}

exports.bkCancellationFeeSave = async req => {
  let doc = common.docValidate(req),
  user = req.user, curDate = new Date()
  let cancellationFee = doc.cancellationFee
  if(cancellationFee && cancellationFee.length > 0) {
    let pro_bl = await tb_proforma_bl.findOne({
      where: {
        state: GLBConfig.ENABLE,
        relation_export_masterbl_id: doc.export_masterbl_id,
        bk_cancellation_status: GLBConfig.ENABLE
      }
    })
    if(!pro_bl) {
      let ves = await tb_vessel.findOne({
        where: {
          export_vessel_id: doc.export_vessel_id,
          state: GLBConfig.ENABLE
        }
      })
      if(ves) {
        let pro_ves = await tb_proforma_vessel.findOne({
          where: {
            export_vessel_name: ves.export_vessel_name.trim(),
            export_vessel_voyage: ves.export_vessel_voyage.trim(),
            state: GLBConfig.ENABLE
          }
        })
        if(pro_ves) {
          pro_bl = await tb_proforma_bl.findOne({
            where: {
              state: GLBConfig.ENABLE,
              export_vessel_id: pro_ves.export_vessel_id,
              export_masterbl_bl: doc.export_masterbl_bl,
              bk_cancellation_status: GLBConfig.ENABLE
            }
          })
        }
      }
    }
    if(!pro_bl) {
      let bl = await tb_bl.findOne({
        where: {
          state: GLBConfig.ENABLE,
          export_masterbl_id: doc.export_masterbl_id
        }
      })
      let ves = await tb_vessel.findOne({
        where: {
          export_vessel_id: bl.export_vessel_id
        }
      })
      let pro_ves = await tb_proforma_vessel.findOne({
        where: {
          export_vessel_name: ves.export_vessel_name,
          export_vessel_voyage: ves.export_vessel_voyage,
          state: GLBConfig.ENABLE
        }
      })
      if(!pro_ves) {
        pro_ves = await tb_proforma_vessel.create({
          export_vessel_code: ves.export_vessel_code,
          export_vessel_name: ves.export_vessel_name,
          export_vessel_voyage: ves.export_vessel_voyage,
          export_vessel_etd: ves.export_vessel_etd
        })
      }
      pro_bl = await tb_proforma_bl.create({
        relation_export_masterbl_id: bl.export_masterbl_id,
        export_vessel_id: pro_ves.export_vessel_id,
        export_masterbl_bl_carrier: bl.export_masterbl_bl_carrier,
        export_masterbl_bl: bl.export_masterbl_bl,
        export_masterbl_forwarder_company: bl.export_masterbl_forwarder_company,
        export_masterbl_cargo_nature: bl.export_masterbl_cargo_nature,
        export_masterbl_cargo_descriptions: bl.export_masterbl_cargo_descriptions,
        proforma_import: GLBConfig.ENABLE
      })
    }
    if(pro_bl) {
      pro_bl.bk_cancellation_status = GLBConfig.ENABLE
      let fees = await tb_shipment_fee.findAll({
        where: {
          export_masterbl_id: pro_bl.export_masterbl_id,
          state: GLBConfig.ENABLE
        }
      })
      for(let f of fees) {
        if(f.shipment_fee_status === 'RE') {
          return common.error('bk_cancellation_fee_01')
        }
      }
      let bkCancellationFees = ['LOO', 'DND']
      let suFees = []
      let totalCancellationFee = 0
      for(let f of fees) {
        if(bkCancellationFees.indexOf(f.fee_data_code) >= 0) {
          let existFlg = false
          for(let cf of cancellationFee) {
            if(f.fee_data_code === cf.fee_data_code) {
              f.shipment_fee_amount = cf.fee_data_amount
              if(f.shipment_fee_status === 'IN') {
                let inf = await tb_uploadfile.findOne({
                  where: {
                    uploadfile_id: f.shipment_fee_invoice_id,
                    state: GLBConfig.ENABLE
                  }
                })
                if(inf) {
                  inf.state = GLBConfig.DISABLE
                  inf.updated_at = curDate
                  await inf.save()
                }
              }
              existFlg = true
              break
            }
          }
          if(!existFlg) {
            f.state = GLBConfig.DISABLE
          } else {
            f.shipment_fee_save_by = user.user_id
            f.shipment_fee_save_at = new Date()
            f.shipment_fee_submit_by = null
            f.shipment_fee_submit_at = null
            f.shipment_fee_approve_by = null
            f.shipment_fee_approve_at = null
            f.shipment_fee_invoice_by = null
            f.shipment_fee_invoice_at = null
            f.shipment_fee_invoice_no = null
            f.shipment_fee_receipt_by = null
            f.shipment_fee_receipt_at = null
            f.shipment_fee_receipt_no = null
            f.shipment_fee_invoice_id = null
            f.shipment_fee_receipt_id = null
            f.shipment_fee_status = 'SA'
            f.updated_at = curDate
            suFees.push(f)
            totalCancellationFee = new Decimal(totalCancellationFee).plus(new Decimal(f.shipment_fee_amount))
          }
        } else {
          f.state = GLBConfig.DISABLE
        }
        await f.save()
      }

      for(let cf of cancellationFee) {
        let exist = false
        for(let f of fees) {
          if(f.fee_data_code === cf.fee_data_code) {
            exist = true
            break
          }
        }
        if(!exist) {
          await tb_shipment_fee.create({
            export_masterbl_id: pro_bl.export_masterbl_id,
            fee_data_code: cf.fee_data_code,
            fee_data_fixed: '1',
            shipment_fee_supplement: '0',
            shipment_fee_type: 'R',
            shipment_fee_fixed_amount: '1',
            shipment_fee_amount: cf.fee_data_amount,
            shipment_fee_currency: 'USD',
            shipment_fee_status: 'SA',
            shipment_fee_save_by: user.user_id,
            shipment_fee_save_at: new Date(),
            shipment_fee_submit_by: user.user_id,
            shipment_fee_submit_at: curDate
          })
        }
      }
      await pro_bl.save()
    }
  }
  return common.success()
}

exports.frimBookingAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let bl = await tb_bl.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    if(bl.export_masterbl_firm_booking === 'YES') {
      bl.export_masterbl_firm_booking = 'NO'
    } else {
      bl.export_masterbl_firm_booking = 'YES'
    }
    bl.export_masterbl_firm_booking_user = user.user_id
    bl.export_masterbl_firm_booking_time = moment().format('YYYY-MM-DD HH:mm:ss')
    await bl.save()
  }
  return common.success()
}

exports.bookingExportAct = async (req, res) => {
  let doc = common.docValidate(req)
  let etd_start_date = doc.etd_start_date
  let etd_end_date = doc.etd_end_date
  let masterbi_bl = doc.masterbi_bl
  let vessel_id = doc.vessel_id
  let firm_booking = doc.firm_booking
  let forwarder = doc.forwarder
  let shipper = doc.shipper
  let consignee = doc.consignee
  let renderData = []
  let vessel_sheet = []
  let bl_sheet = []
  let container_sheet = []
  let queryStr = ``
  let replacements = []
  if(masterbi_bl || firm_booking || forwarder || shipper || consignee) {
    queryStr = `SELECT mb.*, sc.count_size_type FROM tbl_zhongtan_export_masterbl mb 
              LEFT JOIN (SELECT a.export_container_bl, a.export_vessel_id, GROUP_CONCAT(group_size_type) count_size_type FROM ((SELECT export_container_bl, export_vessel_id, CONCAT(COUNT(export_container_size_type), 'x', export_container_size_type) group_size_type FROM tbl_zhongtan_export_container WHERE state = 1 GROUP BY export_container_bl, export_vessel_id, export_container_size_type)) a GROUP BY a.export_container_bl, a.export_vessel_id) sc ON mb.export_masterbl_bl = sc.export_container_bl AND mb.export_vessel_id = sc.export_vessel_id 
              WHERE state = 1 `
    if(masterbi_bl) {
      queryStr += ` AND export_masterbl_bl LIKE ?`
      replacements.push('%'+ masterbi_bl + '%')
    }
    if(firm_booking) {
      queryStr += ` AND export_masterbl_firm_booking = ?`
      replacements.push(firm_booking)
    }
    if(forwarder) {
      queryStr += ` AND export_masterbl_forwarder_company = ?`
      replacements.push(forwarder)
    } 
    if(shipper) {
      queryStr += ` AND export_masterbl_shipper_company LIKE ?`
      replacements.push('%'+ shipper + '%')
    }
    if(consignee) {
      queryStr += ` AND export_masterbl_consignee_company LIKE ?`
      replacements.push('%'+ consignee + '%')
    }
    if((etd_start_date && etd_end_date) || vessel_id) {
      queryStr += ` AND mb.export_vessel_id IN ( SELECT export_vessel_id FROM tbl_zhongtan_export_vessel WHERE state = '1' `
      if(etd_start_date && etd_end_date) {
        queryStr = queryStr + ` AND STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") >= ? AND STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") <= ? `
        replacements.push(moment(etd_start_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
        replacements.push(moment(etd_end_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
      }
      if(vessel_id) {
        queryStr = queryStr + ` AND export_vessel_id = ? `
        replacements.push(vessel_id)
      }
      queryStr += `)`
    }

    let bls = await model.simpleSelect(queryStr, replacements)
    if(bls && bls.length > 0) {
      let ves = []
      for(let b of bls) {
        let numbers = []
        let types = []
        if(b.count_size_type) {
          if(b.count_size_type.indexOf(',') >= 0) {
            let sts = b.count_size_type.split(',')
            for(let st of sts) {
              if(st) {
                let s = st.split('x')
                numbers.push(s[0])
                types.push(s[1])
              }
            }
          } else {
            let st = b.count_size_type.split('x')
            numbers.push(st[0])
            types.push(st[1])
          }
        }
        b.export_masterbl_container_number = numbers.join('\r\n')
        b.export_masterbl_container_type = types.join('\r\n')
        bl_sheet.push(b)

        if(ves.indexOf(b.export_vessel_id) < 0) {
          ves.push(b.export_vessel_id)
          queryStr = `SELECT * FROM tbl_zhongtan_export_vessel WHERE state = '1' AND export_vessel_id = ?`
          replacements = [b.export_vessel_id]
          let vessels = await model.simpleSelect(queryStr, replacements)
          if(vessels && vessels.length > 0) {
            for(let v of vessels) {
              vessel_sheet.push(v)
            }
          }
        }

        queryStr = `SELECT * FROM tbl_zhongtan_export_container WHERE state = '1' AND export_vessel_id = ? AND export_container_bl = ? `
        replacements = [b.export_vessel_id, b.export_masterbl_bl]
        let containers = await model.simpleSelect(queryStr, replacements)
        if(containers && containers.length > 0) {
          for(let c of containers) {
            container_sheet.push(c)
          }
        }
      }
    }
  } else {
    queryStr = `SELECT * FROM tbl_zhongtan_export_vessel WHERE state = '1' `
    if(etd_start_date && etd_end_date) {
      queryStr = queryStr + ` AND STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") >= ? AND STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") <= ? `
      replacements.push(moment(etd_start_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
      replacements.push(moment(etd_end_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
    }
    if(vessel_id) {
      queryStr = queryStr + ` AND export_vessel_id = ? `
      replacements.push(vessel_id)
    }
    queryStr = queryStr + ` ORDER BY STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") DESC `
    let vessels = await model.simpleSelect(queryStr, replacements)

    queryStr = `SELECT mb.*, sc.count_size_type FROM tbl_zhongtan_export_masterbl mb 
              LEFT JOIN (SELECT a.export_container_bl, a.export_vessel_id, GROUP_CONCAT(group_size_type) count_size_type FROM ((SELECT export_container_bl, export_vessel_id, CONCAT(COUNT(export_container_size_type), 'x', export_container_size_type) group_size_type FROM tbl_zhongtan_export_container WHERE state = 1 GROUP BY export_container_bl, export_vessel_id, export_container_size_type)) a GROUP BY a.export_container_bl, a.export_vessel_id) sc ON mb.export_masterbl_bl = sc.export_container_bl AND mb.export_vessel_id = sc.export_vessel_id 
              WHERE state = 1 AND mb.export_vessel_id IN (SELECT export_vessel_id FROM tbl_zhongtan_export_vessel WHERE state = '1' `
    if(etd_start_date && etd_end_date) {
      queryStr = queryStr + ` AND STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") >= ? AND STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") <= ? `
      replacements.push(moment(etd_start_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
      replacements.push(moment(etd_end_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
    }
    if(vessel_id) {
      queryStr = queryStr + ` AND export_vessel_id = ? `
      replacements.push(vessel_id)
    }
    queryStr = queryStr + `) `
    let bls = await model.simpleSelect(queryStr, replacements)

    queryStr = `SELECT * FROM tbl_zhongtan_export_container WHERE state = '1' AND export_vessel_id IN (SELECT export_vessel_id FROM tbl_zhongtan_export_vessel WHERE state = '1' `
    if(etd_start_date && etd_end_date) {
      queryStr = queryStr + ` AND STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") >= ? AND STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") <= ? `
      replacements.push(moment(etd_start_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
      replacements.push(moment(etd_end_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
    }
    if(vessel_id) {
      queryStr = queryStr + ` AND export_vessel_id = ? `
      replacements.push(vessel_id)
    }
    queryStr = queryStr + `) `
    let containers = await model.simpleSelect(queryStr, replacements)

    if(vessels && vessels.length > 0) {
      for(let v of vessels) {
        vessel_sheet.push(v)
        if(bls) {
          for(let b of bls) {
            if(b.export_vessel_id === v.export_vessel_id && b.export_masterbl_bl.indexOf('*') < 0) {
              let numbers = []
              let types = []
              if(b.count_size_type) {
                if(b.count_size_type.indexOf(',') >= 0) {
                  let sts = b.count_size_type.split(',')
                  for(let st of sts) {
                    if(st) {
                      let s = st.split('x')
                      numbers.push(s[0])
                      types.push(s[1])
                    }
                  }
                } else {
                  let st = b.count_size_type.split('x')
                  numbers.push(st[0])
                  types.push(st[1])
                }
              }
              b.export_masterbl_container_number = numbers.join('\r\n')
              b.export_masterbl_container_type = types.join('\r\n')
              if(b.export_masterbl_empty_release_approve_date) {
                b.export_masterbl_empty_release = 'YES'
              } else {
                b.export_masterbl_empty_release = 'NO'
              }
              if(b.export_masterbl_rollover_charge && b.export_masterbl_rollover_charge === '1') {
                b.export_masterbl_rollover_charge = 'YES'
              } else {
                b.export_masterbl_rollover_charge = 'NO'
              }
              bl_sheet.push(b)

              if(containers) {
                for(let c of containers) {
                  if(c.export_vessel_id === v.export_vessel_id && c.export_container_bl === b.export_masterbl_bl && b.export_masterbl_bl.indexOf('*') < 0) {
                    container_sheet.push(c)
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  renderData.push(vessel_sheet)
  renderData.push(bl_sheet)
  renderData.push(container_sheet)
  let filepath = await common.ejs2xlsx('BOOKINGSTATISTICS.xlsx', renderData)
  res.sendFile(filepath)
}

exports.deleteBookingAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_bl.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    bl.state = GLBConfig.DISABLE
    await bl.save()
    let cons = await tb_container.findAll({
      where: {
        state: GLBConfig.ENABLE,
        export_vessel_id: bl.export_vessel_id,
        export_container_bl: bl.export_masterbl_bl
      }
    })
    for(let c of cons) {
      c.state = GLBConfig.DISABLE
      await c.save()
    }
  }
  return common.success()
}

exports.countRolloverChargeAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let bl = await tb_bl.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    bl.export_masterbl_rollover_charge = GLBConfig.ENABLE
    await bl.save()
    await this.createRolloverCharge(bl.export_masterbl_bl, user.user_id)
  }
}

exports.deleteRolloverChargeAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let bl = await tb_bl.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    bl.export_masterbl_rollover_charge = GLBConfig.DISABLE
    await bl.save()
    let pbs = await tb_proforma_bl.findAll({
      where: {
        export_masterbl_bl : bl.export_masterbl_bl,
        bk_cancellation_status: GLBConfig.DISABLE,
        state: GLBConfig.ENABLE
      },
      order: [['export_masterbl_id', 'DESC']]
    })
    if(pbs && pbs.length > 0) {
      for(let pb of pbs) {
        let rlc_fee = await tb_shipment_fee.findOne({
          where: {
            fee_data_code: 'RLC',
            shipment_fee_type: 'R',
            export_masterbl_id: pb.export_masterbl_id,
            state: GLBConfig.ENABLE
          }
        })
        if(rlc_fee) {
          if(rlc_fee.shipment_fee_status !== 'RE') {
            // 未开收据，删除重新添加
            rlc_fee.state = GLBConfig.DISABLE
            await rlc_fee.save()
            if(rlc_fee.shipment_fee_status === 'IN') {
              // 已开发票，删除对应发票
              let inf = await tb_uploadfile.findOne({
                where: {
                  uploadfile_id: rlc_fee.shipment_fee_invoice_id,
                  state: GLBConfig.ENABLE
                }
              })
              if(inf) {
                inf.state = GLBConfig.DISABLE
                inf.updated_at = curDate
                await inf.save()
              }
              let in_other_fees = await tb_shipment_fee.findAll({
                where: {
                  shipment_fee_invoice_id: rlc_fee.shipment_fee_invoice_id,
                  shipment_fee_type: 'R',
                  state: GLBConfig.ENABLE
                }
              })
              if(in_other_fees && in_other_fees.length > 0) {
                for(let iof of in_other_fees) {
                  iof.shipment_fee_save_by = user.user_id
                  iof.shipment_fee_save_at = new Date()
                  iof.shipment_fee_submit_by = null
                  iof.shipment_fee_submit_at = null
                  iof.shipment_fee_approve_by = null
                  iof.shipment_fee_approve_at = null
                  iof.shipment_fee_invoice_by = null
                  iof.shipment_fee_invoice_at = null
                  iof.shipment_fee_invoice_no = null
                  iof.shipment_fee_receipt_by = null
                  iof.shipment_fee_receipt_at = null
                  iof.shipment_fee_receipt_no = null
                  iof.shipment_fee_invoice_id = null
                  iof.shipment_fee_receipt_id = null
                  iof.shipment_fee_status = 'SA'
                  iof.updated_at = curDate
                  await iof.save()
                }
              }
            } else if(rlc_fee.shipment_fee_status === 'SU') {
              // 删除未处理的审核
              let evs = await tb_verification.findAll({
                where: {
                  export_masterbl_id: pb.export_masterbl_id,
                  export_verification_api_name: 'SHIPMENT RELEASE',
                  export_verification_state: 'PM',
                  state : GLBConfig.ENABLE
                }
              })
              if(evs && evs.length > 0) {
                for(let e of evs) {
                  e.state = GLBConfig.DISABLE
                  await e.save()

                  let fee_logs = tb_shipment_fee_log.findAll({
                    where: {
                      shipment_relation_id: e.export_verification_id,
                      state: GLBConfig.ENABLE
                    }
                  })

                  if(fee_logs && fee_logs.length > 0) {
                    for(let fl of fee_logs) {
                      let sf = await tb_shipment_fee.findOne({
                        where: {
                          shipment_fee_id: fl.shipment_fee_id,
                          shipment_fee_status: 'SU',
                          state: GLBConfig.ENABLE
                        }
                      })
                      if(sf) {
                        sf.shipment_fee_save_by = user.user_id
                        sf.shipment_fee_save_at = new Date()
                        sf.shipment_fee_submit_by = null
                        sf.shipment_fee_submit_at = null
                        sf.shipment_fee_approve_by = null
                        sf.shipment_fee_approve_at = null
                        sf.shipment_fee_invoice_by = null
                        sf.shipment_fee_invoice_at = null
                        sf.shipment_fee_invoice_no = null
                        sf.shipment_fee_receipt_by = null
                        sf.shipment_fee_receipt_at = null
                        sf.shipment_fee_receipt_no = null
                        sf.shipment_fee_invoice_id = null
                        sf.shipment_fee_receipt_id = null
                        sf.shipment_fee_status = 'SA'
                        sf.updated_at = curDate
                        await sf.save()
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } 
  }
}

exports.createRolloverCharge = async (masterbl_bl, user_id) => {
  let rbls = await tb_bl.findAll({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_bl : masterbl_bl,
      export_masterbl_rollover_charge: GLBConfig.ENABLE
    }
  })
  if(rbls && rbls.length > 0) {
    let pbs = await tb_proforma_bl.findAll({
      where: {
        export_masterbl_bl : masterbl_bl,
        bk_cancellation_status: GLBConfig.DISABLE,
        state: GLBConfig.ENABLE
      },
      order: [['export_masterbl_id', 'DESC']]
    })
    if(pbs && pbs.length > 0) {
      let rlcs = await tb_export_fee_data.findAll({
        where: {
          fee_data_code: 'RLC',
          fee_data_receivable: GLBConfig.ENABLE,
          state: GLBConfig.ENABLE
        }
      })
      if(rlcs && rlcs.length > 0) {
        for(let pb of pbs) {
          let rlc_fee = await tb_shipment_fee.findOne({
            where: {
              fee_data_code: 'RLC',
              shipment_fee_type: 'R',
              export_masterbl_id: pb.export_masterbl_id,
              state: GLBConfig.ENABLE
            }
          })
          let bl_containers = await tb_container.findAll({
            where: {
              export_vessel_id: rbls[0].export_vessel_id,
              export_container_bl: rbls[0].export_masterbl_bl,
              state: GLBConfig.ENABLE
            }
          })
          let rlc_amount = 0
          if(bl_containers && bl_containers.length > 0) {
            for(let bc of bl_containers) {
              for(let rlc of rlcs) {
                if(rlc.fee_data_receivable_amount && bc.export_container_size_type === rlc.fee_data_container_size) {
                  rlc_amount = new Decimal(rlc_amount).plus(new Decimal(rlc.fee_data_receivable_amount))
                }
              }
            }
          }
          if(rlc_fee) {
            if(rlc_fee.shipment_fee_status !== 'RE') {
              // 未开收据，删除重新添加
              rlc_fee.state = GLBConfig.DISABLE
              await rlc_fee.save()
              if(rlc_fee.shipment_fee_status === 'IN') {
                // 已开发票，删除对应发票
                let inf = await tb_uploadfile.findOne({
                  where: {
                    uploadfile_id: rlc_fee.shipment_fee_invoice_id,
                    state: GLBConfig.ENABLE
                  }
                })
                if(inf) {
                  inf.state = GLBConfig.DISABLE
                  inf.updated_at = new Date()
                  await inf.save()
                }
                let in_other_fees = await tb_shipment_fee.findAll({
                  where: {
                    shipment_fee_invoice_id: rlc_fee.shipment_fee_invoice_id,
                    shipment_fee_type: 'R',
                    state: GLBConfig.ENABLE
                  }
                })
                if(in_other_fees && in_other_fees.length > 0) {
                  for(let iof of in_other_fees) {
                    iof.shipment_fee_save_by = user_id
                    iof.shipment_fee_save_at = new Date()
                    iof.shipment_fee_submit_by = null
                    iof.shipment_fee_submit_at = null
                    iof.shipment_fee_approve_by = null
                    iof.shipment_fee_approve_at = null
                    iof.shipment_fee_invoice_by = null
                    iof.shipment_fee_invoice_at = null
                    iof.shipment_fee_invoice_no = null
                    iof.shipment_fee_receipt_by = null
                    iof.shipment_fee_receipt_at = null
                    iof.shipment_fee_receipt_no = null
                    iof.shipment_fee_invoice_id = null
                    iof.shipment_fee_receipt_id = null
                    iof.shipment_fee_status = 'SA'
                    iof.updated_at = new Date()
                    await iof.save()
                  }
                }
              } else if(rlc_fee.shipment_fee_status === 'SU') {
                // 删除未处理的审核
                let evs = await tb_verification.findAll({
                  where: {
                    export_masterbl_id: pb.export_masterbl_id,
                    export_verification_api_name: 'SHIPMENT RELEASE',
                    export_verification_state: 'PM',
                    state : GLBConfig.ENABLE
                  }
                })
                if(evs && evs.length > 0) {
                  for(let e of evs) {
                    e.state = GLBConfig.DISABLE
                    await e.save()
  
                    let fee_logs = tb_shipment_fee_log.findAll({
                      where: {
                        shipment_relation_id: e.export_verification_id,
                        state: GLBConfig.ENABLE
                      }
                    })
  
                    if(fee_logs && fee_logs.length > 0) {
                      for(let fl of fee_logs) {
                        let sf = await tb_shipment_fee.findOne({
                          where: {
                            shipment_fee_id: fl.shipment_fee_id,
                            shipment_fee_status: 'SU',
                            state: GLBConfig.ENABLE
                          }
                        })
                        if(sf) {
                          sf.shipment_fee_save_by = user_id
                          sf.shipment_fee_save_at = new Date()
                          sf.shipment_fee_submit_by = null
                          sf.shipment_fee_submit_at = null
                          sf.shipment_fee_approve_by = null
                          sf.shipment_fee_approve_at = null
                          sf.shipment_fee_invoice_by = null
                          sf.shipment_fee_invoice_at = null
                          sf.shipment_fee_invoice_no = null
                          sf.shipment_fee_receipt_by = null
                          sf.shipment_fee_receipt_at = null
                          sf.shipment_fee_receipt_no = null
                          sf.shipment_fee_invoice_id = null
                          sf.shipment_fee_receipt_id = null
                          sf.shipment_fee_status = 'SA'
                          sf.updated_at = new Date()
                          await sf.save()
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          await tb_shipment_fee.create({
            export_masterbl_id: pb.export_masterbl_id,
            fee_data_code: 'RLC',
            fee_data_fixed: '1',
            shipment_fee_supplement: '0',
            shipment_fee_type: 'R',
            shipment_fee_fixed_amount: '1',
            shipment_fee_amount: Decimal.isDecimal(rlc_amount) ? rlc_amount.toNumber() : rlc_amount,
            shipment_fee_currency: 'USD',
            shipment_fee_status: 'SA',
            shipment_fee_save_by: user_id,
            shipment_fee_save_at: new Date()
          })
        }
      }
    } 
  }
}