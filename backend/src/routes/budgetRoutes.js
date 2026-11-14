const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');

router.get('/:year/:month/alerts', budgetController.getSmartAlerts);
router.get('/:year/:month', budgetController.getByYearMonth);
router.post('/', budgetController.create);
router.put('/:id', budgetController.update);

module.exports = router;
