// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, requireAdmin } = require('../middleware/auth');

// Rotas públicas
router.post('/registrar', requireAdmin, authController.registrar);
router.post('/login', authController.login);

// Rotas protegidas
router.post('/logout', auth, authController.logout);
router.post('/logout-todos', auth, authController.logoutTodos);
router.get('/perfil', auth, authController.getPerfil);
router.put('/perfil', auth, authController.atualizarPerfil);
router.put('/alterar-senha', auth, authController.alterarSenha);

module.exports = router;