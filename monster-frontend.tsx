import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, DollarSign, RefreshCw } from 'lucide-react';

// CONFIGURAÇÃO: Altere a URL do backend quando fizer deploy
const API_URL = 'http://localhost:3000/api';

export default function MonsterPromoTracker() {
  const [produtos, setProdutos] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [promocoes, setPromocoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  // Carregar produtos ao iniciar
  useEffect(() => {
    carregarProdutos();
    
    // Auto-refresh a cada 2 minutos
    const interval = setInterval(() => {
      carregarProdutos();
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Carregar produtos do backend
  const carregarProdutos = async () => {
    try {
      const response = await fetch(`${API_URL}/produtos`);
      const data = await response.json();
      setProdutos(data);
      setUltimaAtualizacao(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      setLoading(false);
    }
  };

  // Carregar promoções de um produto
  const carregarPromocoes = async (produtoId) => {
    try {
      const response = await fetch(`${API_URL}/produtos/${produtoId}/promocoes`);
      const data = await response.json();
      setPromocoes(data);
      
      // Encontrar o produto selecionado
      const produto = produtos.find(p => p.id === produtoId);
      setProdutoSelecionado(produto);
    } catch (error) {
      console.error('Erro ao carregar promoções:', error);
    }
  };

  // Voltar para grid
  const voltarParaGrid = () => {
    setProdutoSelecionado(null);
    setPromocoes([]);
  };

  // Formatar data/hora
  const formatarDataHora = (isoString) => {
    const data = new Date(isoString);
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Formatar preço
  const formatarPreco = (preco) => {
    return `R$ ${preco.toFixed(2).replace('.', ',')}`;
  };

  // Copiar coordenadas
  const copiarCoordenadas = (latitude, longitude) => {
    const coords = `${latitude}, ${longitude}`;
    navigator.clipboard.writeText(coords).then(() => {
      alert('📍 Coordenadas copiadas!');
    }).catch(() => {
      alert('❌ Erro ao copiar coordenadas');
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-[#16a34a] animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Carregando promoções...</p>
        </div>
      </div>
    );
  }

  // PÁGINA DE DETALHES
  if (produtoSelecionado) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white p-4 md:p-8">
        {/* Header */}
        <div className="max-w-6xl mx-auto">
          <button
            onClick={voltarParaGrid}
            className="flex items-center gap-2 text-[#a3a3a3] hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar</span>
          </button>

          {/* Produto Info */}
          <div className="flex items-center gap-6 mb-8">
            <img
              src={produtoSelecionado.imagem_url}
              alt={produtoSelecionado.nome}
              className="w-32 h-48 object-contain"
            />
            <div>
              <h1 className="text-3xl font-bold mb-2">{produtoSelecionado.nome}</h1>
              <div className="inline-block px-4 py-2 rounded-lg bg-[#16a34a] text-white font-semibold">
                {promocoes.length} {promocoes.length === 1 ? 'PROMOÇÃO ENCONTRADA' : 'PROMOÇÕES ENCONTRADAS'}
              </div>
            </div>
          </div>

          {/* Tabela de Promoções */}
          {promocoes.length === 0 ? (
            <div className="text-center py-12 text-[#a3a3a3]">
              <p>Nenhuma promoção ativa no momento</p>
            </div>
          ) : (
            <div className="bg-[#262626] rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#2d2d2d]">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#a3a3a3]">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Data/Hora
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#a3a3a3]">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Local
                        </div>
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-[#a3a3a3]">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Preço
                        </div>
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-[#a3a3a3]">
                        Localização
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#404040]">
                    {promocoes.map((promo, index) => (
                      <tr key={index} className="hover:bg-[#2d2d2d] transition-colors">
                        <td className="px-6 py-4 text-sm">
                          {formatarDataHora(promo.data_venda)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-semibold mb-1">{promo.nome_estabelecimento}</div>
                            <div className="text-[#a3a3a3] text-xs">
                              {promo.endereco_completo}
                            </div>
                            <div className="text-[#a3a3a3] text-xs">
                              {promo.municipio} - CEP: {promo.cep}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[#16a34a] font-bold text-lg">
                            {formatarPreco(promo.preco_venda)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => copiarCoordenadas(promo.latitude, promo.longitude)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#16a34a] hover:bg-[#15803d] text-white rounded-lg transition-colors text-sm font-medium"
                          >
                            <MapPin className="w-4 h-4" />
                            Copiar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PÁGINA PRINCIPAL - GRID DE PRODUTOS
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Monster Promo Tracker</h1>
          <p className="text-[#a3a3a3]">
            Promoções atualizadas automaticamente
            {ultimaAtualizacao && (
              <span className="ml-2">
                • Última atualização: {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </p>
        </div>

        {/* Grid de Produtos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {produtos.map((produto) => {
            const temPromocao = produto.total_promocoes > 0;
            
            return (
              <button
                key={produto.id}
                onClick={() => carregarPromocoes(produto.id)}
                className="bg-[#262626] rounded-lg overflow-hidden hover:bg-[#2d2d2d] transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#16a34a]/20 group"
              >
                {/* Imagem do Produto */}
                <div className="aspect-[2/3] flex items-center justify-center p-4 bg-[#1a1a1a]">
                  <img
                    src={produto.imagem_url}
                    alt={produto.nome}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Badge de Status */}
                <div className="p-3">
                  <div
                    className={`
                      px-4 py-2 rounded-lg font-semibold text-sm text-center transition-all duration-300
                      ${temPromocao 
                        ? 'bg-[#16a34a] text-white shadow-lg shadow-[#16a34a]/50' 
                        : 'bg-[#dc2626] text-white shadow-lg shadow-[#dc2626]/50'
                      }
                    `}
                  >
                    {temPromocao ? 'PROMOÇÃO ATIVA' : 'SEM PROMOÇÃO'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}