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
router.post('/configuration/CustomerAdmin/:method', services.CustomerControl)
router.post('/configuration/Employee/:method', services.EmployeeControl)
router.post('/configuration/IcdConfig/:method', services.IcdConfigControl)
router.post('/configuration/ContainerSizeConfig/:method', services.ContainerSizeConfigControl)
router.post('/configuration/DischargePortConfig/:method', services.DischargePortConfigControl)
router.post('/configuration/EdiDepotConfig/:method', services.EdiDepotConfigControl)
router.post('/configuration/AllotDepotConfig/:method', services.AllotDepotControl)

router.post('/export/Booking/:method', services.BookingControl)
router.post('/export/BookingWork/:method', services.BookingWorkControl)
router.post('/export/Receipt/:method', services.ReceiptControl)
router.post('/export/BookingLoad/:method', services.BookingLoadControl)
router.post('/export/CommercialVerification/:method', services.CommercialVerificationControl)
router.post('/export/BusinessVerification/:method', services.BusinessVerificationControl)
router.post('/export/ShipmentProforma/:method', services.ShipmentProformaControl)
router.post('/export/ShipmentRelease/:method', services.ShipmentReleaseControl)
router.post('/export/ShipmentReceipt/:method', services.ShipmentReceiptControl)
router.post('/export/FreightChargeStatus/:method', services.FreightChargeStatusControl)
router.post('/export/ExportStatistics/:method', services.ExportStatisticsControl)

router.post('/import/ImportWork/:method', services.ImportWorkControl)
router.post('/invoice/Invoice/:method', services.InvoiceControl)
router.post('/invoice/InvoiceReceipt/:method', services.InvoiceReceiptControl)
router.post('/invoice/ManagerCheck/:method', services.ManagerCheckControl)
router.post('/invoice/BusinessCheck/:method', services.BusinessCheckControl)
router.post('/invoice/InvoiceSearch/:method', services.InvoiceSearchControl)
router.post('/invoice/InvoiceStatistics/:method', services.InvoiceStatisticsControl)

router.post('/web/SailSchedule/:method', services.SailScheduleControl)
router.post('/web/WebConfig/:method', services.WebConfigControl)
router.post('/web/Web/:method', services.WebControl)

router.post('/fee/InvoiceDefaultFee/:method', services.InvoiceDefaultFeeControl)
router.post('/fee/CustomerFixedDeposit/:method', services.CustomerFixedDepositControl)
router.post('/fee/CustomerFixedReceipt/:method', services.CustomerFixedReceiptControl)
router.post('/fee/ExportFeeData/:method', services.ExportFeeDataControl)

router.post('/equipment/OverdueCalculationConfig/:method', services.OverdueCalculationConfigControl)
router.post('/equipment/ImportOverdueCalculation/:method', services.ImportOverdueCalculationControl)
router.post('/equipment/ImportOverdueCalculationAdmin/:method', services.ImportOverdueCalculationControl)
router.post('/equipment/ImportOverdueCalculationReceipt/:method', services.ImportOverdueReceiptControl)
router.post('/equipment/ImportOverdueCalculationReceiptAdmin/:method', services.ImportOverdueReceiptControl)
router.post('/equipment/ImportOverdueCalculationSearch/:method', services.ImportOverdueCalculationSearchControl)
router.post('/equipment/ImportOverdueCalculationSearchAdmin/:method', services.ImportOverdueCalculationSearchControl)
router.post('/equipment/ImportOverdueStatistics/:method', services.ImportOverdueStatisticsControl)
router.post('/equipment/ImportDemurrageStatisticsInvoice/:method', services.ImportDemurrageStatisticsInvoiceControl)
router.post('/equipment/ImportDemurrageStatisticsInvoiceAdmin/:method', services.ImportDemurrageStatisticsInvoiceControl)
router.post('/equipment/EmptyStockManagement/:method', services.EmptyStockManagementControl)
router.post('/equipment/ContainerMNRLedgerInvoice/:method', services.ContainerMNRLedgerInvoiceControl)
router.post('/equipment/ContainerMNRLedgerReceipt/:method', services.ContainerMNRLedgerReceiptControl)
router.post('/equipment/ContainerMNRLedgerStatistics/:method', services.ContainerMNRLedgerStatisticsControl)
router.post('/equipment/ExportDemurrageCalculation/:method', services.ExportDemurrageCalculationControl)
module.exports = router
