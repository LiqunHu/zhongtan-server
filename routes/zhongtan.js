const express = require('express')
const services = require('./service')
const router = express.Router()

// zhongtan
router.post('/configuration/PortConfig/:method', services.PortConfigControl)
router.post('/configuration/VesselConfig/:method', services.VesselConfigControl)
router.post('/configuration/VoyageConfig/:method', services.VoyageConfigControl)
router.post('/export/Booking/:method', services.BookingControl)
router.post('/export/BookingWork/:method', services.BookingWorkControl)

router.post('/web/SailSchedule/:method', services.SailScheduleControl)
router.post('/web/WebConfig/:method', services.WebConfigControl)
router.post('/web/Web/:method', services.WebControl)

module.exports = router
