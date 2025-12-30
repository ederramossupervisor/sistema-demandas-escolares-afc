const express = require('express');
const router = express.Router();
const demandaController = require('../controllers/demandaController');
const auth = require('../middleware/auth');

// TODAS as rotas de demandas requerem autenticação
router.use(auth);

// =============================================
// ROTAS PRINCIPAIS CRUD
// =============================================

// Criar nova demanda
router.post('/', demandaController.criarDemanda);

// Listar todas as demandas (com filtros)
router.get('/', demandaController.listarDemandas);

// Obter uma demanda específica
router.get('/:id', demandaController.obterDemanda);

// Atualizar demanda
router.put('/:id', demandaController.atualizarDemanda);

// Deletar demanda
router.delete('/:id', demandaController.deletarDemanda);

// =============================================
// ROTAS ESPECÍFICAS
// =============================================

// Adicionar comentário a uma demanda
router.post('/:id/comentarios', demandaController.adicionarComentario);

// Obter estatísticas gerais
router.get('/estatisticas/geral', async (req, res) => {
  try {
    const usuario = req.user;
    let filtros = {};

    // Aplicar filtros baseados no nível de acesso
    if (usuario.tipo === 'supervisao') {
      filtros.escola = { $in: usuario.escolas };
    } else if (usuario.tipo === 'gestao') {
      filtros.escola = usuario.escola;
    } else if (usuario.tipo === 'comum') {
      filtros.escola = usuario.escola;
      filtros.departamento = usuario.departamento;
    }

    // Executar todas as consultas em paralelo para melhor performance
    const [
      totalDemandas,
      demandasPorStatus,
      demandasPorPrioridade,
      demandasPorEscola,
      demandasAtrasadas
    ] = await Promise.all([
      demandaController.obterContagemDemandas(filtros),
      demandaController.obterDemandasPorStatus(filtros),
      demandaController.obterDemandasPorPrioridade(filtros),
      demandaController.obterDemandasPorEscola(filtros),
      demandaController.obterDemandasAtrasadas(filtros)
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalDemandas,
        demandasPorStatus,
        demandasPorPrioridade,
        demandasPorEscola,
        demandasAtrasadas,
        usuario: {
          tipo: usuario.tipo,
          escola: usuario.escola,
          departamento: usuario.departamento
        }
      }
    });

  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas. Tente novamente.'
    });
  }
});

// Obter "Minhas Demandas" (criadas por mim + atribuídas a mim)
router.get('/usuario/minhas', async (req, res) => {
  try {
    const usuario = req.user;
    
    // Demandas criadas pelo usuário
    const filtrosCriadas = { criadoPor: usuario._id };
    const demandasCriadas = await demandaController.listarDemandasPorFiltro(filtrosCriadas);

    // Demandas atribuídas ao usuário
    const filtrosAtribuidas = { responsavel: usuario._id };
    const demandasAtribuidas = await demandaController.listarDemandasPorFiltro(filtrosAtribuidas);

    res.status(200).json({
      success: true,
      data: {
        criadas: demandasCriadas,
        atribuidas: demandasAtribuidas,
        total: demandasCriadas.length + demandasAtribuidas.length
      }
    });

  } catch (error) {
    console.error('Erro ao obter minhas demandas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter suas demandas. Tente novamente.'
    });
  }
});

// Obter demandas por escola específica
router.get('/escola/:nomeEscola', async (req, res) => {
  try {
    const { nomeEscola } = req.params;
    const usuario = req.user;

    // Verificar permissão para acessar esta escola
    if (usuario.tipo === 'comum' && usuario.escola !== nomeEscola) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para ver demandas desta escola'
      });
    }

    if (usuario.tipo === 'supervisao' && !usuario.escolas.includes(nomeEscola)) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para ver demandas desta escola'
      });
    }

    if (usuario.tipo === 'gestao' && usuario.escola !== nomeEscola) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para ver demandas desta escola'
      });
    }

    const filtros = { escola: nomeEscola };
    const demandas = await demandaController.listarDemandasPorFiltro(filtros);

    res.status(200).json({
      success: true,
      data: {
        escola: nomeEscola,
        total: demandas.length,
        demandas: demandas
      }
    });

  } catch (error) {
    console.error('Erro ao obter demandas da escola:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter demandas da escola. Tente novamente.'
    });
  }
});

// =============================================
// ROTA DE TESTE PARA VERIFICAÇÃO
// =============================================

router.get('/teste/conexao', auth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Rotas de demandas estão funcionando!',
    usuario: {
      id: req.user.id,
      nome: req.user.nome,
      tipo: req.user.tipo,
      escola: req.user.escola
    },
    rotas_disponiveis: [
      'POST /api/demandas - Criar nova demanda',
      'GET /api/demandas - Listar demandas (com filtros)',
      'GET /api/demandas/:id - Obter demanda específica',
      'PUT /api/demandas/:id - Atualizar demanda',
      'DELETE /api/demandas/:id - Deletar demanda',
      'POST /api/demandas/:id/comentarios - Adicionar comentário',
      'GET /api/demandas/estatisticas/geral - Estatísticas gerais',
      'GET /api/demandas/usuario/minhas - Minhas demandas',
      'GET /api/demandas/escola/:nomeEscola - Demandas por escola'
    ]
  });
});

module.exports = router;