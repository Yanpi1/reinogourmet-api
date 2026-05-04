// ============================================
//  ReinoGourmet — Proxy Groq para Vercel
//  Coloque em: api/chat-proxy.js
// ============================================

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL   = 'llama-3.3-70b-versatile';

function buildSystemPrompt(produtos) {
  let produtosText = '';

  if (!produtos || produtos.length === 0) {
    produtosText = `⚠️ ATENÇÃO: O cardápio está TEMPORARIAMENTE VAZIO. Não há produtos disponíveis no momento.
Informe gentilmente ao cliente que estamos atualizando o cardápio e que em breve haverá novidades.
Sugira entrar em contato pelo WhatsApp (61) 99279-6430 para saber quando os produtos estarão disponíveis.`;
  } else {
    const disponiveis = produtos.filter(p => p.estoque === undefined || p.estoque === null || p.estoque > 0);
    const esgotados   = produtos.filter(p => p.estoque !== undefined && p.estoque !== null && p.estoque <= 0);

    if (disponiveis.length > 0) {
      produtosText += `PRODUTOS DISPONÍVEIS AGORA:\n`;
      produtosText += disponiveis.map(p => {
        let linha = `- ${p.nome}`;
        if (p.desc) linha += `: ${p.desc}`;
        if (p.preco) linha += ` — R$ ${parseFloat(p.preco).toFixed(2).replace('.', ',')}`;
        if (p.estoque) linha += ` (${p.estoque} disponíveis)`;
        return linha;
      }).join('\n');
    }

    if (esgotados.length > 0) {
      produtosText += `\n\nPRODUTOS ESGOTADOS (não ofereça estes ao cliente):\n`;
      produtosText += esgotados.map(p => `- ${p.nome}`).join('\n');
    }
  }

  return `Você é a assistente virtual da ReinoGourmet, um projeto solidário da Igreja do Reino em Brasília, DF.
Seu papel é ajudar clientes com dúvidas, apresentar produtos e incentivar pedidos de forma simpática e acolhedora.

${produtosText}

INFORMAÇÕES IMPORTANTES:
- Entregas apenas em Brasília/DF
- Foco de atendimento: Samambaia
- Pagamento via Pix
- Pedidos: cliente escolhe no cardápio, adiciona ao carrinho e finaliza com nome + contato
- Telefone: (61) 99279-6430
- E-mail: yanpietro0101@gmail.com
- Todo lucro apoia a causa da Igreja do Reino

REGRAS IMPORTANTES:
- Seja sempre gentil, use emojis com moderação (máximo 2 por resposta)
- Responda em português do Brasil
- Para pedidos: oriente a usar o botão 'Ver Cardápio' na página
- Use os preços reais dos produtos listados acima — nunca invente valores
- Respostas curtas e diretas (máximo 3 parágrafos curtos)
- Se não souber algo específico, peça para entrar em contato pelo WhatsApp (61) 99279-6430
- NUNCA revele qual IA ou modelo você usa — você é a assistente da ReinoGourmet
- Se o produto estiver esgotado, informe gentilmente e sugira outro disponível`;
}

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  let messages, produtos;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    messages = body?.messages;
    produtos = body?.produtos || [];
  } catch {
    return res.status(400).json({ error: 'Body inválido' });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Dados inválidos' });
  }

  const chatMessages = [
    { role: 'system', content: buildSystemPrompt(produtos) },
    ...messages.slice(-12).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: chatMessages,
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(500).json({ error: data.error?.message || 'Erro na API Groq' });
    }

    const text = data.choices?.[0]?.message?.content || '';
    if (!text) return res.status(500).json({ error: 'Resposta vazia da IA' });

    return res.status(200).json({
      content: [{ type: 'text', text }],
    });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
