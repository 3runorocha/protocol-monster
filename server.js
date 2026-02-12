// ============================================
// MONSTER PROMO TRACKER - BACKEND
// ============================================
// Stack: Node.js + Express + SQLite + node-cron
// Consulta API Economiza Alagoas a cada 14 minutos
// Filtra promoções válidas (últimas 24h)
// ============================================

//const fetch = require('node-fetch');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const cors = require('cors');
require('dotenv').config({ path: './.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Timestamp da última consulta
let ultimaConsulta = null;

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/webp', express.static('webp'));

// ============================================
// CONFIGURAÇÃO DO BANCO DE DADOS
// ============================================

const db = new sqlite3.Database('./monster_promo.db', (err) => {
  if (err) console.error('Erro ao conectar no banco:', err);
  else console.log('✅ Conectado ao SQLite');
});

// Criar tabelas
db.serialize(() => {
  // Tabela de produtos
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gtin TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      imagem_url TEXT NOT NULL,
      ativo BOOLEAN DEFAULT 1
    )
  `);

  // Tabela de promoções ativas
  db.run(`
    CREATE TABLE IF NOT EXISTS promocoes_ativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id INTEGER NOT NULL,
      preco_venda REAL NOT NULL,
      data_venda TEXT NOT NULL,
      cnpj_estabelecimento TEXT NOT NULL,
      nome_estabelecimento TEXT NOT NULL,
      endereco_completo TEXT NOT NULL,
      municipio TEXT NOT NULL,
      cep TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      ultima_atualizacao TEXT NOT NULL,
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )
  `);

  // Popular produtos iniciais (16 Monsters)
  const produtos = [
    ["0070847022015", "Monster Energy", "/webp/tradicional.webp"],
    ["7898938890076", "Monster Energy Zero", "/webp/tradicional-zero.webp"],
    ["0070847022305", "Monster Absolutely Zero", "/webp/absolutely-zero.webp"],
    ["0070847022206", "Monster Ultra Zero", "/webp/ultra-zero.webp"],
    ["0070847033929", "Monster Ultra Violet", "/webp/ultra-violet.webp"],
    ["7898938890090", "Monster Ultra Peachy", "/webp/ultra-peachy.webp"],
    ["7898938890113", "Monster Ultra Fiesta", "/webp/ultra-fiesta.webp"],
    ["1220000250222", "Monster Ultra Watermelon", "/webp/watermelon.webp"],
    ["1220000250000", "Monster Ultra Paradise", "/webp/ultra-paradise.webp"],
    ["1220000250147", "Monster Khaotic", "/webp/kahotic.webp"],
    ["0070847033301", "Monster Mango Loco", "/webp/mango-loco.webp"],
    ["7898938890045", "Monster Pipeline Punch", "/webp/pipeline-punch.webp"],
    ["7898938890120", "Monster Rio Punch", "/webp/rio-punch.webp"],
    ["1220000250031", "Monster Pacific Punch", "/webp/pacific-punch.webp"],
    ["1220000250406", "Monster Dragon Ice Tea Peach", "/webp/dragon-tea-peach.webp"],
    ["0070847034803", "Monster Dragon Ice Tea Lemon", "/webp/dragon-tea-lemon.webp"]
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO produtos (gtin, nome, imagem_url) VALUES (?, ?, ?)');
  produtos.forEach(p => stmt.run(p));
  stmt.finalize();
});

// ============================================
// CONFIGURAÇÃO DA API ECONOMIZA ALAGOAS
// ============================================

const API_CONFIG = {
  baseURL: 'http://api.sefaz.al.gov.br/sfz-economiza-alagoas-api/api/public/produto/pesquisa',
  appToken: process.env.APP_TOKEN,
  precoAlvo: 9.00,
  latitude: -9.659549,
  longitude: -35.704811,
  raio: 10
};

// ============================================
// FUNÇÃO PRINCIPAL: CONSULTAR API E ATUALIZAR BD
// ============================================

async function consultarPromocoes() {
  console.log(`🔍 [${new Date().toISOString()}] Iniciando consulta de promoções...`);

  try {
    // Buscar todos os produtos ativos
    const produtos = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM produtos WHERE ativo = 1', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Limpar promoções antigas
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM promocoes_ativas', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    let totalPromocoesEncontradas = 0;

    // Consultar API para cada produto
    for (const produto of produtos) {
      try {
        const gtinNormalizado = produto.gtin.replace(/^0+/, '');

        const response = await fetch('http://api.sefaz.al.gov.br/sfz-economiza-alagoas-api/api/public/produto/pesquisa', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'AppToken': API_CONFIG.appToken
          },
          body: JSON.stringify({
            "produto": {
              "gtin": gtinNormalizado
            },
            "estabelecimento": {
              "geolocalizacao": {
                "latitude": -9.659549,
                "longitude": -35.704811,
                "raio": 10
              }
            },
            "dias": 7,
            "pagina": 1,
            "registrosPorPagina": 500
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Erro na API para ${produto.nome}: ${response.status} - ${errorText}`);
          continue;
        }

        const data = await response.json();
        console.log(`✅ ${produto.nome}: ${data.totalRegistros} vendas encontradas`);

        // Filtrar promoções válidas (últimas 24h e abaixo do preço-alvo)
        const agora = new Date();
        const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

        for (const item of data.conteudo || []) {
          const dataVenda = new Date(item.produto.venda.dataVenda);
          const precoVenda = item.produto.venda.valorVenda;

          // Verificar se é válido (últimas 24h E abaixo do preço-alvo)
          if (dataVenda >= limite24h && precoVenda <= API_CONFIG.precoAlvo) {
            const endereco = `${item.estabelecimento.endereco.nomeLogradouro}, ${item.estabelecimento.endereco.numeroImovel} - ${item.estabelecimento.endereco.bairro}`;

            await new Promise((resolve, reject) => {
              db.run(`
                INSERT INTO promocoes_ativas (
                  produto_id, preco_venda, data_venda, cnpj_estabelecimento,
                  nome_estabelecimento, endereco_completo, municipio, cep,
                  latitude, longitude, ultima_atualizacao
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                produto.id,
                precoVenda,
                item.produto.venda.dataVenda,
                item.estabelecimento.cnpj,
                item.estabelecimento.nomeFantasia || item.estabelecimento.razaoSocial,
                endereco,
                item.estabelecimento.endereco.municipio,
                item.estabelecimento.endereco.cep,
                item.estabelecimento.endereco.latitude,
                item.estabelecimento.endereco.longitude,
                new Date().toISOString()
              ], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            totalPromocoesEncontradas++;
          }
        }

      } catch (error) {
        console.error(`❌ Erro ao processar ${produto.nome}:`, error.message);
      }

      // Delay de 1s entre requisições para não sobrecarregar API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`✅ Consulta finalizada! ${totalPromocoesEncontradas} promoções encontradas.`);

    // Atualizar timestamp da última consulta
    ultimaConsulta = new Date().toISOString();

      } catch (error) {
        console.error('❌ Erro na consulta de promoções:', error);
      }
    }

// ============================================
// AGENDAR CONSULTAS A CADA 14 MINUTOS
// ============================================

cron.schedule('*/14 * * * *', () => {
  consultarPromocoes();
});

// Executar imediatamente ao iniciar
consultarPromocoes();

// ============================================
// ROTAS DA API
// ============================================

// Health check para manter o servidor acordado
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/produtos - Lista todos os produtos com status de promoção
app.get('/api/produtos', (req, res) => {
  db.all(`
    SELECT 
      p.*,
      COUNT(pr.id) as total_promocoes
    FROM produtos p
    LEFT JOIN promocoes_ativas pr ON p.id = pr.produto_id
    WHERE p.ativo = 1
    GROUP BY p.id
    ORDER BY total_promocoes DESC, p.id ASC
  `, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET /api/produtos/:id/promocoes - Lista promoções de um produto específico
app.get('/api/produtos/:id/promocoes', (req, res) => {
  const { id } = req.params;

  db.all(`
    SELECT 
      pr.*,
      p.nome as produto_nome,
      p.imagem_url as produto_imagem
    FROM promocoes_ativas pr
    JOIN produtos p ON pr.produto_id = p.id
    WHERE pr.produto_id = ?
    ORDER BY pr.preco_venda ASC, pr.data_venda DESC
  `, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET /api/status - Status do sistema
app.get('/api/status', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM promocoes_ativas', (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      status: 'online',
      totalPromocoes: row.total,
      precoAlvo: API_CONFIG.precoAlvo,
      ultimaAtualizacao: ultimaConsulta || new Date().toISOString()
    });
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📍 Município configurado: ${API_CONFIG.municipio}`);
  console.log(`💰 Preço-alvo: R$ ${API_CONFIG.precoAlvo.toFixed(2)}`);
  console.log(`⏰ Consultas automáticas a cada 14 minutos`);
});