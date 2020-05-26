const express = require('express')
const services = require('./service')
const router = express.Router()

// zhongtan
router.post('/configuration/PortConfig/:method', services.PortConfigControl)
router.post('/configuration/VesselConfig/:method', services.VesselConfigControl)
router.post('/configuration/VoyageConfig/:method', services.VoyageConfigControl)
router.post('/configuration/ContainerManagerConfig/:method', services.ContainerManagerConfigControl)
router.post('/configuration/BillladingNoConfig/:method', services.BillladingNoConfigControl)
router.post('/configuration/Customer/:method', services.CustomerControl)
router.post('/configuration/Employee/:method', services.EmployeeControl)
router.post('/export/Booking/:method', services.BookingControl)
router.post('/export/BookingWork/:method', services.BookingWorkControl)
router.post('/export/Receipt/:method', services.ReceiptControl)
router.post('/import/ImportWork/:method', services.ImportWorkControl)
router.post('/invoice/Invoice/:method', services.InvoiceControl)
router.post('/invoice/InvoiceReceipt/:method', services.InvoiceReceiptControl)
router.post('/invoice/ManagerCheck/:method', services.ManagerCheckControl)
router.post('/invoice/BusinessCheck/:method', services.BusinessCheckControl)
router.post('/invoice/InvoiceSearch/:method', services.InvoiceSearchControl)

router.post('/web/SailSchedule/:method', services.SailScheduleControl)
router.post('/web/WebConfig/:method', services.WebConfigControl)
router.post('/web/Web/:method', services.WebControl)

router.post('/fee/InvoiceDefaultFee/:method', services.InvoiceDefaultFeeControl)
router.post('/fee/CustomerFixedDeposit/:method', services.CustomerFixedDepositControl)
router.post('/fee/CustomerFixedReceipt/:method', services.CustomerFixedReceiptControl)

router.post('/configuration/IcdConfig/:method', services.IcdConfigControl)

router.post('/configuration/ContainerSizeConfig/:method', services.ContainerSizeConfigControl)
router.post('/configuration/ContainerTypeConfig/:method', services.ContainerTypeConfigControl)
router.post('/configuration/DischargePortConfig/:method', services.DischargePortConfigControl)

module.exports = router
