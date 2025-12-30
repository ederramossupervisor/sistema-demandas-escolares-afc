const Demanda = require('../models/Demanda');
const User = require('../models/User');

// Criar nova demanda
exports.criarDemanda = async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      escola,
      departamento,
      prioridade,
      prazo,
      responsavel
    } = req.body;

    // Validar campos obrigatórios
    if (!titulo || !descricao || !escola || !departamento || !prazo) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, preencha todos os campos obrigatórios'
      });
    }

    // Validar data do prazo
    const dataPrazo = new Date(prazo);
    if (dataPrazo <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'O prazo deve ser uma data futura'
      });
    }

    // Criar a demanda
    const novaDemanda = new Demanda({
      titulo,
      descricao,
      escola,
      departamento,
      prioridade: prioridade || 'Média',
      prazo: dataPrazo,
      criadoPor: req.user.id,
      responsavel: responsavel || null,
      historico: [{
        usuario: req.user.id,
        acao: 'Criação',
        detalhes: 'Demanda criada'
      }]
    });

    await novaDemanda.save();

    // Adicionar na lista de demandas do usuário criador
    await User.findByIdAndUpdate(
      req.user.id,
      { $push: { demandasCriadas: novaDemanda._id } }
    );

    // Se tiver responsável, adicionar na lista dele
    if (responsavel) {
      await User.findByIdAndUpdate(
        responsavel,
        { $push: { demandasAtribuidas: novaDemanda._id } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Demanda criada com sucesso!',
      data: novaDemanda
    });

  } catch (error) {
    console.error('Erro ao criar demanda:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar demanda. Tente novamente.'
    });
  }
};

// Listar demandas com filtros
exports.listarDemandas = async (req, res) => {
  try {
    const {
      escola,
      departamento,
      status,
      prioridade,
      criadoPor,
      responsavel,
      dataInicio,
      dataFim
    } = req.query;

    // Construir filtros baseados no nível de acesso
    let filtros = {};

    // ADMINISTRADOR: vê todas as demandas
    if (req.user.tipo === 'administrador') {
      // Mantém filtros vazios para ver tudo
    }
    // SUPERVISÃO ESCOLAR: vê demandas das suas escolas
    else if (req.user.tipo === 'supervisao') {
      filtros.escola = { $in: req.user.escolas };
    }
    // GESTÃO ESCOLAR (Diretor): vê demandas da sua escola
    else if (req.user.tipo === 'gestao') {
      filtros.escola = req.user.escola;
    }
    // COMUM: vê apenas demandas do seu departamento na sua escola
    else if (req.user.tipo === 'comum') {
      filtros.escola = req.user.escola;
      filtros.departamento = req.user.departamento;
    }

    // Aplicar filtros opcionais
    if (escola && req.user.tipo === 'administrador') {
      filtros.escola = escola;
    }
    
    if (departamento) {
      filtros.departamento = departamento;
    }
    
    if (status) {
      filtros.status = status;
    }
    
    if (prioridade) {
      filtros.prioridade = prioridade;
    }
    
    if (criadoPor) {
      filtros.criadoPor = criadoPor;
    }
    
    if (responsavel) {
      filtros.responsavel = responsavel;
    }
    
    // Filtrar por data
    if (dataInicio || dataFim) {
      filtros.dataCriacao = {};
      if (dataInicio) {
        filtros.dataCriacao.$gte = new Date(dataInicio);
      }
      if (dataFim) {
        filtros.dataCriacao.$lte = new Date(dataFim);
      }
    }

    // Buscar demandas com população dos relacionamentos
    const demandas = await Demanda.find(filtros)
      .populate('criadoPor', 'nome email')
      .populate('responsavel', 'nome email')
      .populate('historico.usuario', 'nome')
      .sort({ dataCriacao: -1 });

    res.status(200).json({
      success: true,
      count: demandas.length,
      data: demandas
    });

  } catch (error) {
    console.error('Erro ao listar demandas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar demandas. Tente novamente.'
    });
  }
};

// Obter uma demanda específica
exports.obterDemanda = async (req, res) => {
  try {
    const demanda = await Demanda.findById(req.params.id)
      .populate('criadoPor', 'nome email tipo')
      .populate('responsavel', 'nome email')
      .populate('historico.usuario', 'nome')
      .populate('comentarios.usuario', 'nome');

    if (!demanda) {
      return res.status(404).json({
        success: false,
        message: 'Demanda não encontrada'
      });
    }

    // Verificar permissão de acesso
    const temPermissao = verificarPermissaoAcesso(req.user, demanda);
    if (!temPermissao) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para acessar esta demanda'
      });
    }

    res.status(200).json({
      success: true,
      data: demanda
    });

  } catch (error) {
    console.error('Erro ao obter demanda:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar demanda. Tente novamente.'
    });
  }
};

// Atualizar demanda
exports.atualizarDemanda = async (req, res) => {
  try {
    const { id } = req.params;
    const atualizacoes = req.body;

    // Buscar demanda existente
    const demanda = await Demanda.findById(id);
    if (!demanda) {
      return res.status(404).json({
        success: false,
        message: 'Demanda não encontrada'
      });
    }

    // Verificar permissão para editar
    const podeEditar = verificarPermissaoEdicao(req.user, demanda);
    if (!podeEditar) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para editar esta demanda'
      });
    }

    // Registrar mudanças no histórico
    const alteracoes = [];
    
    if (atualizacoes.status && atualizacoes.status !== demanda.status) {
      alteracoes.push(`Status alterado de "${demanda.status}" para "${atualizacoes.status}"`);
      
      // Se concluída, registrar data de conclusão
      if (atualizacoes.status === 'Concluída') {
        atualizacoes.dataConclusao = new Date();
      }
    }
    
    if (atualizacoes.responsavel && atualizacoes.responsavel.toString() !== demanda.responsavel?.toString()) {
      const novoResponsavel = await User.findById(atualizacoes.responsavel);
      alteracoes.push(`Responsável alterado para "${novoResponsavel?.nome || 'Não definido'}"`);
      
      // Atualizar listas de demandas dos usuários
      if (demanda.responsavel) {
        await User.findByIdAndUpdate(
          demanda.responsavel,
          { $pull: { demandasAtribuidas: demanda._id } }
        );
      }
      await User.findByIdAndUpdate(
        atualizacoes.responsavel,
        { $push: { demandasAtribuidas: demanda._id } }
      );
    }

    // Adicionar ao histórico
    if (alteracoes.length > 0) {
      atualizacoes.$push = {
        historico: {
          usuario: req.user.id,
          acao: 'Atualização',
          detalhes: alteracoes.join(', ')
        }
      };
    }

    // Atualizar demanda
    const demandaAtualizada = await Demanda.findByIdAndUpdate(
      id,
      atualizacoes,
      { new: true, runValidators: true }
    ).populate('criadoPor', 'nome email')
     .populate('responsavel', 'nome email');

    res.status(200).json({
      success: true,
      message: 'Demanda atualizada com sucesso!',
      data: demandaAtualizada
    });

  } catch (error) {
    console.error('Erro ao atualizar demanda:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar demanda. Tente novamente.'
    });
  }
};

// Deletar demanda (apenas administrador e criador)
exports.deletarDemanda = async (req, res) => {
  try {
    const demanda = await Demanda.findById(req.params.id);

    if (!demanda) {
      return res.status(404).json({
        success: false,
        message: 'Demanda não encontrada'
      });
    }

    // Verificar permissão para deletar (apenas admin ou criador)
    if (req.user.tipo !== 'administrador' && 
        demanda.criadoPor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para deletar esta demanda'
      });
    }

    // Remover das listas dos usuários
    await User.findByIdAndUpdate(
      demanda.criadoPor,
      { $pull: { demandasCriadas: demanda._id } }
    );

    if (demanda.responsavel) {
      await User.findByIdAndUpdate(
        demanda.responsavel,
        { $pull: { demandasAtribuidas: demanda._id } }
      );
    }

    await demanda.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Demanda deletada com sucesso!'
    });

  } catch (error) {
    console.error('Erro ao deletar demanda:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar demanda. Tente novamente.'
    });
  }
};

// Adicionar comentário
exports.adicionarComentario = async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;

    if (!texto || texto.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'O comentário não pode estar vazio'
      });
    }

    const demanda = await Demanda.findById(id);
    if (!demanda) {
      return res.status(404).json({
        success: false,
        message: 'Demanda não encontrada'
      });
    }

    // Verificar permissão de acesso
    const temPermissao = verificarPermissaoAcesso(req.user, demanda);
    if (!temPermissao) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para comentar nesta demanda'
      });
    }

    const comentario = {
      usuario: req.user.id,
      texto: texto.trim()
    };

    const demandaAtualizada = await Demanda.findByIdAndUpdate(
      id,
      { $push: { comentarios: comentario } },
      { new: true }
    ).populate('comentarios.usuario', 'nome');

    res.status(200).json({
      success: true,
      message: 'Comentário adicionado com sucesso!',
      data: demandaAtualizada.comentarios
    });

  } catch (error) {
    console.error('Erro ao adicionar comentário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao adicionar comentário. Tente novamente.'
    });
  }
};

// Funções auxiliares de verificação de permissão
function verificarPermissaoAcesso(usuario, demanda) {
  // Administrador pode ver tudo
  if (usuario.tipo === 'administrador') return true;
  
  // Supervisão pode ver demandas das suas escolas
  if (usuario.tipo === 'supervisao') {
    return usuario.escolas.includes(demanda.escola);
  }
  
  // Gestão pode ver demandas da sua escola
  if (usuario.tipo === 'gestao') {
    return usuario.escola === demanda.escola;
  }
  
  // Comum pode ver demandas do seu departamento na sua escola
  if (usuario.tipo === 'comum') {
    return usuario.escola === demanda.escola && 
           usuario.departamento === demanda.departamento;
  }
  
  return false;
}

function verificarPermissaoEdicao(usuario, demanda) {
  // Administrador pode editar tudo
  if (usuario.tipo === 'administrador') return true;
  
  // Criador pode editar (exceto se for comum e demanda já atribuída)
  if (demanda.criadoPor.toString() === usuario.id) {
    if (usuario.tipo === 'comum' && demanda.responsavel) {
      return false; // Comum não pode editar demandas já atribuídas
    }
    return true;
  }
  
  // Responsável pode editar status e adicionar comentários
  if (demanda.responsavel && demanda.responsavel.toString() === usuario.id) {
    return true;
  }
  
  // Supervisão pode editar demandas das suas escolas
  if (usuario.tipo === 'supervisao') {
    return usuario.escolas.includes(demanda.escola);
  }
  
  // Gestão pode editar demandas da sua escola
  if (usuario.tipo === 'gestao') {
    return usuario.escola === demanda.escola;
  }
  
  return false;
}
// =============================================
// FUNÇÕES AUXILIARES PARA ESTATÍSTICAS E RELATÓRIOS
// =============================================

exports.obterContagemDemandas = async (filtros) => {
  return await Demanda.countDocuments(filtros);
};

exports.obterDemandasPorStatus = async (filtros) => {
  return await Demanda.aggregate([
    { $match: filtros },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
};

exports.obterDemandasPorPrioridade = async (filtros) => {
  return await Demanda.aggregate([
    { $match: filtros },
    { $group: { _id: "$prioridade", count: { $sum: 1 } } }
  ]);
};

exports.obterDemandasPorEscola = async (filtros) => {
  return await Demanda.aggregate([
    { $match: filtros },
    { $group: { _id: "$escola", count: { $sum: 1 } } }
  ]);
};

exports.obterDemandasAtrasadas = async (filtros) => {
  // Criar uma cópia para não modificar o original
  const filtrosComAtraso = { ...filtros };
  filtrosComAtraso.status = { $in: ['Pendente', 'Em Andamento'] };
  filtrosComAtraso.prazo = { $lt: new Date() };
  return await Demanda.countDocuments(filtrosComAtraso);
};

exports.listarDemandasPorFiltro = async (filtros) => {
  return await Demanda.find(filtros)
    .populate('criadoPor', 'nome email')
    .populate('responsavel', 'nome email')
    .sort({ dataCriacao: -1 });
};
// Exporta todas as funções
module.exports = {
  criarDemanda: exports.criarDemanda,
  listarDemandas: exports.listarDemandas,
  obterDemanda: exports.obterDemanda,
  atualizarDemanda: exports.atualizarDemanda,
  deletarDemanda: exports.deletarDemanda,
  adicionarComentario: exports.adicionarComentario,
  obterContagemDemandas: exports.obterContagemDemandas,
  obterDemandasPorStatus: exports.obterDemandasPorStatus,
  obterDemandasPorPrioridade: exports.obterDemandasPorPrioridade,
  obterDemandasPorEscola: exports.obterDemandasPorEscola,
  obterDemandasAtrasadas: exports.obterDemandasAtrasadas,
  listarDemandasPorFiltro: exports.listarDemandasPorFiltro
};